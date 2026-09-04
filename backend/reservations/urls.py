from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReservationViewSet

app_name = "reservations"

router = DefaultRouter()
router.register(r"reservations", ReservationViewSet, basename="reservation")

urlpatterns = [
    path("", include(router.urls)),
]