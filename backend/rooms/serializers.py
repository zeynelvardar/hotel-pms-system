from rest_framework import serializers
from .models import RoomType, Room


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