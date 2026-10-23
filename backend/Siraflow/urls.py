from django.urls import path
from .views import ParseSchemaView

urlpatterns = [
    # L'adresse finale sera : http://127.0.0.1:8000/api/parse/
    path('parse/', ParseSchemaView.as_view(), name='parse-schema'),
]