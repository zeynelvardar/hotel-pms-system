from rest_framework import serializers
from .models import Guest
from reservations.models import Reservation

class GuestReservationHistorySerializer(serializers.ModelSerializer):
    """Misafir profili içinde gösterilecek hafifletilmiş geçmiş konaklama özeti."""
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Reservation
        fields = [
            "id",
            "room_number",
            "check_in_date",
            "check_out_date",
            "status",
            "status_display",
            "total_price",
        ]

class GuestSerializer(serializers.ModelSerializer):
    """
    Misafir CRUD ve Listeleme Serializer'ı.
    - total_stays: Veritabanında Count() ile hesaplanan toplam konaklama sayısı.
    - reservations: N+1 olmadan Prefetch ile çekilen geçmiş konaklamalar.
    """
    total_stays = serializers.IntegerField(read_only=True, default=0)
    reservations = GuestReservationHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Guest
        fields = [
            "id",
            "first_name",
            "last_name",
            "tc_no",
            "passport_no",
            "birth_date",
            "email",
            "phone",
            "is_main_guest",
            "total_stays",
            "reservations",
            "created_at",
            "updated_at",
        ]