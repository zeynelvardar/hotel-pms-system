from rest_framework import serializers
from .models import Guest
from reservations.models import Reservation


class GuestReservationHistorySerializer(serializers.ModelSerializer):
    """Misafir profili içinde gösterilecek hafifletilmiş geçmiş konaklama özeti."""
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    agency_display = serializers.CharField(source="get_agency_display", read_only=True)

    class Meta:
        model = Reservation
        fields = [
            "id",
            "room_number",
            "agency",
            "agency_display",
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
    gender_display = serializers.CharField(source="get_gender_display", read_only=True)
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
            "gender",
            "gender_display",
            "email",
            "phone",
            "is_main_guest",
            "total_stays",
            "reservations",
            "created_at",
            "updated_at",
        ]
        # Nested update işlemlerinde DRF'in ID zorunluluğunu aşmak için
        extra_kwargs = {
            'id': {'read_only': False, 'required': False},
            'tc_no': {'validators': []}, # Kendi custom validate mantığımızı yazacağımız için default unique validatorü eziyoruz
            'passport_no': {'validators': []}
        }