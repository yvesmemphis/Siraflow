import { parse as parseYaml } from 'yaml';
import type { ApiDocument, ApiEndpoint, ApiOperation, ApiParameter, ApiResponseDoc, ExampleOrigin, HttpMethod } from '../types';

type Dict = Record<string, unknown>;
const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

function asDict(value: unknown): Dict {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Dict : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function pointerSegment(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* keep the literal pointer segment */ }
  return decoded.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolveRef(value: unknown, root: Dict, seen = new Set<string>()): unknown {
  const referenceObject = asDict(value);
  const reference = text(referenceObject.$ref);
  if (!reference || !reference.startsWith('#/')) return value;
  if (seen.has(reference)) return {};

  let target: unknown = root;
  for (const segment of reference.slice(2).split('/').map(pointerSegment)) {
    if (Array.isArray(target)) {
      const index = Number(segment);
      target = Number.isInteger(index) ? target[index] : undefined;
    } else {
      target = asDict(target)[segment];
    }
    if (target === undefined) return value;
  }

  const resolved = resolveRef(target, root, new Set([...seen, reference]));
  const siblings = Object.fromEntries(Object.entries(referenceObject).filter(([key]) => key !== '$ref'));
  if (Object.keys(siblings).length && resolved !== null && typeof resolved === 'object' && !Array.isArray(resolved)) {
    return { ...asDict(resolved), ...siblings };
  }
  return resolved;
}

function schemaExample(schemaValue: unknown, root: Dict, depth = 0): unknown {
  if (depth > 7) return null;
  const schema = asDict(resolveRef(schemaValue, root));
  if (schema.example !== undefined) return resolveRef(schema.example, root);
  if (Array.isArray(schema.examples) && schema.examples.length) return resolveRef(schema.examples[0], root);
  if (schema.default !== undefined) return resolveRef(schema.default, root);
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];

  const objectType = schema.type === 'object' || Boolean(schema.properties);
  const composed = asList(schema.allOf);
  if (objectType || composed.length) {
    const properties: Record<string, unknown> = {};
    for (const item of composed) Object.assign(properties, asDict(asDict(resolveRef(item, root)).properties));
    Object.assign(properties, asDict(schema.properties));
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) result[key] = schemaExample(value, root, depth + 1);
    return result;
  }
  const unions = asList(schema.oneOf).length ? asList(schema.oneOf) : asList(schema.anyOf);
  if (unions.length) return schemaExample(unions[0], root, depth + 1);
  if (schema.type === 'array') return [schemaExample(schema.items, root, depth + 1)];

  if (schema.format === 'date-time') return '2026-10-23T12:00:00.000Z';
  if (schema.format === 'date') return '2026-10-23';
  if (schema.format === 'email') return 'alex@example.com';
  if (schema.format === 'uuid') return '550e8400-e29b-41d4-a716-446655440000';
  if (schema.type === 'integer' || schema.type === 'number') return 1;
  if (schema.type === 'boolean') return true;
  if (schema.type === 'string' || schema.format) return schema.format === 'password' ? '••••••••' : 'string';
  return null;
}

function exampleFromExampleMap(value: unknown, root: Dict): unknown {
  const first = asDict(resolveRef(Object.values(asDict(value))[0], root));
  return first.value === undefined ? undefined : resolveRef(first.value, root);
}

function normalizeParameter(value: unknown, root: Dict): ApiParameter {
  const parameter = asDict(resolveRef(value, root));
  const schema = asDict(resolveRef(parameter.schema, root));
  const type = text(schema.type, text(parameter.type, 'string'));
  const location = text(parameter.in, 'query');
  const example = parameter.example ?? schema.example ?? exampleFromExampleMap(parameter.examples, root);
  const defaultValue = parameter.default ?? schema.default;
  return {
    name: text(parameter.name, 'paramètre'),
    location,
    required: parameter.required === true,
    description: text(parameter.description),
    type,
    example,
    defaultValue
  };
}

interface NormalizedExample {
  value: unknown;
  origin: ExampleOrigin;
}

function responseExample(value: unknown, root: Dict): NormalizedExample | undefined {
  const response = asDict(resolveRef(value, root));
  const content = asDict(response.content);
  const firstMedia = asDict(resolveRef(Object.values(content)[0], root));
  if (firstMedia.example !== undefined) return { value: resolveRef(firstMedia.example, root), origin: 'declared' };
  const namedExample = exampleFromExampleMap(firstMedia.examples, root);
  if (namedExample !== undefined) return { value: namedExample, origin: 'declared' };
  const legacyExamples = asDict(response.examples);
  const legacy = Object.values(legacyExamples)[0];
  if (legacy !== undefined) return { value: resolveRef(legacy, root), origin: 'declared' };
  const schema = firstMedia.schema ?? response.schema;
  if (schema === undefined) return undefined;
  const derived = schemaExample(schema, root);
  return derived === undefined || derived === null ? undefined : { value: derived, origin: 'schema-derived' };
}

function normalizeResponses(value: unknown, root: Dict): ApiResponseDoc[] {
  const responses = asDict(value);
  const entries = Object.entries(responses).map(([status, raw]) => {
    const response = asDict(resolveRef(raw, root));
    const normalizedExample = responseExample(raw, root);
    return {
      status,
      description: text(response.description, 'Réponse'),
      ...(normalizedExample ? { example: normalizedExample.value, exampleOrigin: normalizedExample.origin } : {})
    };
  });
  return entries.length ? entries : [{ status: '200', description: 'Réponse réussie' }];
}

function normalizeOperation(method: HttpMethod, rawValue: unknown, commonParams: unknown[], root: Dict): ApiOperation {
  const operation = asDict(resolveRef(rawValue, root));
  const ownParams = asList(operation.parameters);
  const merged = new Map<string, ApiParameter>();
  for (const item of [...commonParams, ...ownParams]) {
    const param = normalizeParameter(item, root);
    merged.set(`${param.location}:${param.name}`, param);
  }
  const params = [...merged.values()];
  const bodyParameter = params.find((param) => param.location === 'body');
  const filteredParams = params.filter((param) => param.location !== 'body');

  const bodyRaw = asDict(resolveRef(operation.requestBody, root));
  const content = asDict(bodyRaw.content);
  const firstContentType = Object.keys(content)[0];
  const firstContent = asDict(resolveRef(content[firstContentType], root));
  const bodyExample = bodyRaw.example
    ?? firstContent.example
    ?? exampleFromExampleMap(firstContent.examples, root)
    ?? bodyParameter?.example;
  const bodySchema = firstContent.schema ?? asDict(bodyParameter).schema;
  let requestBody = bodyExample;
  let requestBodyOrigin: ExampleOrigin | undefined = bodyExample === undefined ? undefined : 'declared';
  if (requestBody === undefined && bodySchema !== undefined) {
    const derived = schemaExample(bodySchema, root);
    if (derived !== undefined && derived !== null) {
      requestBody = derived;
      requestBodyOrigin = 'schema-derived';
    }
  }

  return {
    method,
    summary: text(operation.summary, text(operation.operationId, `${method} : requête`)),
    description: text(operation.description),
    operationId: text(operation.operationId, `${method.toLowerCase()}Operation`),
    tags: asList(operation.tags).filter((tag): tag is string => typeof tag === 'string'),
    headers: filteredParams.filter((param) => param.location === 'header'),
    queryParams: filteredParams.filter((param) => param.location === 'query'),
    pathParams: filteredParams.filter((param) => param.location === 'path'),
    requestBody,
    requestBodyOrigin,
    requestBodyRequired: bodyRaw.required === true || bodyParameter?.required === true,
    requestContentType: text(firstContentType, text(asList(operation.consumes)[0], 'application/json')),
    responses: normalizeResponses(operation.responses, root)
  };
}

export function parseSchemaText(source: string): unknown {
  const trimmed = source.trim();
  if (!trimmed) throw new Error('Le fichier ou la réponse est vide.');
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    try {
      return parseYaml(trimmed) as unknown;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'format invalide';
      throw new Error(`Impossible de lire la spécification JSON/YAML : ${detail}`);
    }
  }
}

export function normalizeOpenApi(value: unknown, fallbackTitle = 'API importée', isDemo = false): ApiDocument {
  const root = asDict(value);
  const info = asDict(resolveRef(root.info, root));
  const paths = asDict(root.paths);
  const openApiVersion = text(root.openapi);
  const swaggerVersion = text(root.swagger);
  const specFormat: ApiDocument['specFormat'] = openApiVersion ? 'OpenAPI' : swaggerVersion ? 'Swagger' : 'Unknown';
  const specVersion = openApiVersion || swaggerVersion || 'non déclarée';
  if (!Object.keys(paths).length) throw new Error('Aucun objet « paths » n’a été trouvé. Vérifiez qu’il s’agit d’une spécification OpenAPI ou Swagger.');
  const endpoints: ApiEndpoint[] = [];
  for (const [path, rawPath] of Object.entries(paths)) {
    const pathItem = asDict(resolveRef(rawPath, root));
    const commonParams = asList(pathItem.parameters);
    const methods = HTTP_METHODS.flatMap((method) => {
      const operation = pathItem[method.toLowerCase()];
      return operation ? [normalizeOperation(method, operation, commonParams, root)] : [];
    });
    if (methods.length) endpoints.push({ path, methods });
  }
  if (!endpoints.length) throw new Error('Aucune opération HTTP prise en charge n’a été trouvée dans cette spécification.');

  const serverObject = asDict(asList(root.servers)[0]);
  const legacyHost = text(root.host);
  const legacyScheme = text(asList(root.schemes)[0], 'https');
  const legacyPath = text(root.basePath, '');
  const server = text(serverObject.url, legacyHost ? `${legacyScheme}://${legacyHost}${legacyPath}` : '');
  return {
    title: text(info.title, fallbackTitle),
    description: text(info.description, 'Aucune description de l’API n’est déclarée dans cette spécification.'),
    version: text(info.version, 'non déclarée'),
    specFormat,
    specVersion,
    server: server.replace(/\/$/, ''),
    endpoints,
    isDemo
  };
}
