from rest_framework import serializers


class SchemaInputSerializer(serializers.Serializer):
    schema_json = serializers.JSONField()

    def validate(self, data):
        schema = data['schema_json']
        if not isinstance(schema, dict):
            raise serializers.ValidationError({
                'schema_json': "La spécification doit être un objet JSON."
            })

        if not isinstance(schema.get('info'), dict):
            raise serializers.ValidationError({
                'schema_json': "La spécification doit contenir un objet 'info'."
            })

        paths = schema.get('paths')
        if not isinstance(paths, dict) or not paths:
            raise serializers.ValidationError({
                'schema_json': "La spécification doit contenir un objet 'paths' non vide."
            })

        return data