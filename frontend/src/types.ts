export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type ExampleOrigin = 'declared' | 'schema-derived';

export interface ApiParameter {
  name: string;
  location: string;
  required: boolean;
  description: string;
  type: string;
  example?: unknown;
  defaultValue?: unknown;
}

export interface ApiResponseDoc {
  status: string;
  description: string;
  example?: unknown;
  exampleOrigin?: ExampleOrigin;
}

export interface ApiOperation {
  method: HttpMethod;
  summary: string;
  description: string;
  operationId: string;
  tags: string[];
  headers: ApiParameter[];
  queryParams: ApiParameter[];
  pathParams: ApiParameter[];
  requestBody?: unknown;
  requestBodyOrigin?: ExampleOrigin;
  requestBodyRequired: boolean;
  requestContentType?: string;
  responses: ApiResponseDoc[];
}

export interface ApiEndpoint {
  path: string;
  methods: ApiOperation[];
}

export interface ApiDocument {
  title: string;
  description: string;
  version: string;
  specFormat: 'OpenAPI' | 'Swagger' | 'Unknown';
  specVersion: string;
  server: string;
  endpoints: ApiEndpoint[];
  isDemo?: boolean;
}

export interface TestRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface TestResponse {
  status: number;
  statusText: string;
  duration: number;
  body: unknown;
  error?: string;
}
