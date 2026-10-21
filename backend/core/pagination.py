"""
Çekilen veriyi sayfalar, tek seferde 50.000 kayıt
yerine 100 tane getirerek ihtiyaç oldukça devamı açılır.

"""

from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100