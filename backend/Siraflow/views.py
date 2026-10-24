from django.http import JsonResponse
from django.views.decorators.http import require_GET
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import SchemaInputSerializer


@require_GET
def health_check(request):
    return JsonResponse({'status': 'ok'})


class ParseSchemaView(APIView):
    def post(self, request):
        serializer = SchemaInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        schema_data = serializer.validated_data['schema_json']
        nodes = []
        edges = []

        info = schema_data.get('info', {})
        api_title = info.get('title', 'API Root')
        nodes.append({
            'id': 'root',
            'type': 'input',
            'label': api_title,
            'position': {'x': 250, 'y': 20}
        })

        paths = schema_data.get('paths', {})
        y_offset = 120
        x_offset = 50

        for idx, (path, methods) in enumerate(paths.items()):
            if not isinstance(methods, dict):
                continue
            node_id = f"node_{idx}"
            method_list = [
                method.upper()
                for method in methods
                if method.lower() in {'get', 'post', 'put', 'delete', 'patch'}
            ]
            if not method_list:
                continue

            nodes.append({
                'id': node_id,
                'label': f"{path}\n[{', '.join(method_list)}]",
                'position': {
                    'x': x_offset + (idx % 3) * 280,
                    'y': y_offset + (idx // 3) * 100
                }
            })

            edges.append({
                'id': f"edge_root_{node_id}",
                'source': 'root',
                'target': node_id,
                'animated': True
            })

        if len(nodes) == 1:
            return Response(
                {'schema_json': "Aucune opération HTTP prise en charge n'a été trouvée dans 'paths'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {'schema': schema_data, 'nodes': nodes, 'edges': edges},
            status=status.HTTP_200_OK
        )