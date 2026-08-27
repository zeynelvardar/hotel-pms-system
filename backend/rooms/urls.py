# Oda ve oda tipleri modülü için DRF DefaultRouter kullanarak otomatik RESTful 
# CRUD URL uç noktalarını (endpoints) tanımlayan yönlendirme haritası.

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoomTypeViewSet, RoomViewSet

app_name = "rooms"

router = DefaultRouter()
router.register(r"room-types", RoomTypeViewSet, basename="room-type")
router.register(r"rooms", RoomViewSet, basename="room")

urlpatterns = [
    path("", include(router.urls)),
]