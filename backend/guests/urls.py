from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GuestViewSet

app_name = "guests"

router = DefaultRouter()
router.register(r"guests", GuestViewSet, basename="guest")

urlpatterns = [
    path("", include(router.urls)),
]