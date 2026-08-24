from typing import Any, Optional
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc: Exception, context: dict[str, Any]) -> Optional[Response]:
    """Tüm API hatalarını standart kurumsal JSON formatınna dönüştürür."""

    response = exception_handler(exc, context) #drf yerleşik fonksiyonu: hata yanıtını yaklar oluşturur.

    if response is not None:
        customized_data = {
            "success": False,
            "status_code": response.status_code,
            "errors": response.data,
            "message": "Bir işlem hatası oluştu."
        }

        if response.status_code == status.HTTP_400_BAD_REQUEST:
            customized_data["message"] = "Gönderilen verilerde doğrulama hatası var."
        elif response.status_code == status.HTTP_401_UNAUTHORIZED:
            customized_data["message"] = "Oturum süreniz dolmuş veya yetkiniz yok."
        elif response.status_code == status.HTTP_403_FORBIDDEN:
            customized_data["message"] = "egBu işlemi gerçekleştirmek için yetkiniz bulunmuyor."
        elif response.status_code == status.HTTP_404_NOT_FOUND:
            customized_data["message"] = "İstenen kayıt bulunamadı."
        elif response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR:
            customized_data["message"] = "Sunucu tarafında beklenmeyen bir hata oluştu."

        response.data = customized_data

    return response