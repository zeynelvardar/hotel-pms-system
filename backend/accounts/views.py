# Kullanıcı girişi için JWT token üreten ve mevcut oturum açmış 
# kullanıcının profil bilgilerini dönen API uç noktalarını tanımlar.

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .serializers import CustomTokenObtainPairSerializer, UserSerializer


class CustomTokenObtainPairView(TokenObtainPairView):
    """Kullanıcı adı ve şifre ile JWT token ve kullanıcı profilini döndüren uç."""
    serializer_class = CustomTokenObtainPairSerializer


class CurrentUserView(APIView):
    """Mevcut oturum açmış kullanıcının güncel verilerini döndürür."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


