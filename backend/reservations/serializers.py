from rest_framework import serializers
from .models import Reservation

class DashboardReservationSerializer(serializers.ModelSerializer):
    """
    Resepsiyon panosu için optimize edilmiş salt-okunur (read-only) serializer.
    İlişkili verileri (Misafir ve Oda) düzleştirerek frontend'e hazır hale getirir.
    """
    guest_full_name = serializers.CharField(source="guest.__str__", read_only=True)
    guest_phone = serializers.CharField(source="guest.phone", read_only=True)
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    room_type_code = serializers.CharField(source="room.room_type.code", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Reservation
        fields = [
            "id",
            "guest_full_name",
            "guest_phone",
            "room_number",
            "room_type_code",
            "check_in_date",
            "check_out_date",
            "status",
            "status_display",
            "total_price",
            "notes",
        ]