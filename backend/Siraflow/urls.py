from django.urls import path
from .views import ParseSchemaView, health_check

urlpatterns = [
    # L'adresse finale sera : http://127.0.0.1:8000/api/parse/
    path('health/', health_check, name='health-check'),
    path('parse/', ParseSchemaView.as_view(), name='parse-schema'),
]