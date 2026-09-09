from rest_framework import serializers
from .models import RoomType, Room, RoomStatus


class RoomTypeSerializer(serializers.ModelSerializer):
    """
    Oda tipleri için detaylı CRUD serializer'ı.
    total_rooms_count queryset seviyesindeki annotate işleminden beslenir.
    """
    total_rooms_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = RoomType
        fields = [
            "id",
            "name",
            "code",
            "base_price",
            "max_adults",
            "max_children",
            "description",
            "is_active",
            "total_rooms_count",
            "created_at",
            "updated_at",
        ]


class RoomSerializer(serializers.ModelSerializer):
    """
    Oda listeleme ve yönetim serializer'ı.
    Yazma işlemlerinde doğrudan room_type ID alır, okumada detay objesi sunar.
    """
    room_type_detail = RoomTypeSerializer(source="room_type", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Room
        fields = [
            "id",
            "room_number",
            "room_type",
            "room_type_detail",
            "floor",
            "status",
            "status_display",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        ]

    def validate_room_number(self, value: str) -> str:
        cleaned_value = value.strip().upper()
        if not cleaned_value:
            raise serializers.ValidationError("Oda numarası boş bırakılamaz.")
        return cleaned_value

class RoomStatusUpdateSerializer(serializers.ModelSerializer):
    """Housekeeping operasyonları için sadece statü değişimine izin veren serializer."""
    class Meta:
        model = Room
        fields = ["status"]

    def validate_status(self, value):
        valid_statuses = [choice[0] for choice in RoomStatus.choices]
        if value not in valid_statuses:
            raise serializers.ValidationError("Geçersiz oda statüsü.")
        return value


class RoomRackSerializer(serializers.ModelSerializer):
    """
    Room Rack (Oda Planı) için özel, hafifletilmiş ve birleştirilmiş serializer.
    """
    room_type_code = serializers.CharField(source='room_type.code', read_only=True)
    active_reservation = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = [
            'id', 
            'room_number', 
            'floor', 
            'status', 
            'room_type_code', 
            'active_reservation'
        ]

    def get_active_reservation(self, obj):
        # View katmanında 'Prefetch(to_attr="relevant_reservations")' kullandığımız için
        # obj.relevant_reservations üzerinden N+1 yapmadan ramdeki veriye erişiyoruz.
        reservations = getattr(obj, 'relevant_reservations', [])
        
        if not reservations:
            return None
            
        # Öncelik IN_HOUSE konaklayanda. Eğer yoksa, bugün giriş yapacak (RESERVED) kişiyi al.
        active_res = next((r for r in reservations if r.status == "IN_HOUSE"), None)
        if not active_res:
            active_res = reservations[0] # Bugün gelecek kişi

        return {
            "id": active_res.id,
            "guest_name": f"{active_res.guest.first_name} {active_res.guest.last_name}",
            "status": active_res.status,
            "check_in_date": active_res.check_in_date,
            "check_out_date": active_res.check_out_date,
        }


    