import json

from django.test import TestCase, override_settings


@override_settings(ALLOWED_HOSTS=['localhost'])
class ParseSchemaViewTests(TestCase):
    url = '/api/parse/'
    valid_schema = {
        'openapi': '3.0.0',
        'info': {'title': 'Test API', 'version': '1.0.0'},
        'paths': {'/ping': {'get': {}}},
    }

    def post_schema(self, schema):
        return self.client.post(
            self.url,
            data=json.dumps({'schema_json': schema}),
            content_type='application/json',
            HTTP_HOST='localhost',
        )

    def test_valid_schema_returns_schema_and_graph(self):
        response = self.post_schema(self.valid_schema)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['schema'], self.valid_schema)
        self.assertEqual(response.json()['nodes'][1]['label'], '/ping\n[GET]')
        self.assertEqual(response.json()['edges'][0]['target'], 'node_0')

    def test_missing_schema_is_rejected(self):
        response = self.client.post(
            self.url,
            data='{}',
            content_type='application/json',
            HTTP_HOST='localhost',
        )

        self.assertEqual(response.status_code, 400)

    def test_schema_without_paths_is_rejected(self):
        schema = {**self.valid_schema, 'paths': {}}

        response = self.post_schema(schema)

        self.assertEqual(response.status_code, 400)
        self.assertIn('schema_json', response.json())

    def test_schema_without_supported_operations_is_rejected(self):
        schema = {**self.valid_schema, 'paths': {'/ping': {'parameters': []}}}

        response = self.post_schema(schema)

        self.assertEqual(response.status_code, 400)

    def test_health_check_returns_ok(self):
        response = self.client.get('/api/health/', HTTP_HOST='localhost')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})
