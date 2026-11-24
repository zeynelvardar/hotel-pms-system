"""
Standart sayfalama yapılandırması.
Tek seferde yüksek hacimli veri çekimini engelleyerek bellek ve ağ yükünü dengeler.
"""

from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = "page_size"
    # İstemciden gelebilecek aşırı büyük page_size isteklerine (OOM / DoS) karşı üst sınır
    max_page_size = 200