from rest_framework import serializers
from .models import Reservation
from rooms.models import Room
from guests.models import Guest
from guests.serializers import GuestSerializer

class DashboardReservationSerializer(serializers.ModelSerializer):
    """
    Resepsiyon panosu için optimize edilmiş salt-okunur (read-only) serializer.
    İlişkili verileri (Misafir ve Oda) düzleştirerek frontend'e hazır hale getirir.
    """
    guest_full_name = serializers.CharField(source="guest.__str__", read_only=True)
    guest_name = serializers.CharField(source="guest.__str__", read_only=True)
    guest_phone = serializers.CharField(source="guest.phone", read_only=True)
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    room_type_code = serializers.CharField(source="room.room_type.code", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Reservation
        fields = [
            "id",
            "guest_full_name",
            "guest_name",
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


class ReservationCreateSerializer(serializers.ModelSerializer):
    """
    Yeni rezervasyon oluşturulurken hem misafir bilgisini (nested)
    hem de oda referansını (room / room_id) güvenle sağlayan yazma serializer'ı.
    """
    guest = GuestSerializer(required=False)
    guest_id = serializers.PrimaryKeyRelatedField(
        queryset=Guest.objects.all(), source="guest", required=False
    )
    room = serializers.PrimaryKeyRelatedField(queryset=Room.objects.all(), required=False)
    room_id = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.all(), source="room", required=False
    )

    class Meta:
        model = Reservation
        fields = [
            "id",
            "guest",
            "guest_id",
            "room",
            "room_id",
            "check_in_date",
            "check_out_date",
            "total_price",
            "status",
            "notes",
        ]

    def validate(self, attrs):
        # Odanın hem 'room', hem 'room_id' üzerinden gelme ihtimalini garantiye al.
        if "room" not in attrs:
            raise serializers.ValidationError({"room": "Bir oda seçilmelidir."})
        return attrs


    def create(self, validated_data):
        guest_data = validated_data.get("guest", None)

        # Eğer hazır guest_id verilmediyse ve nested guest objesi geldiyse:
        if guest_data:
            validated_data.pop("guest", None)

            tc_no = guest_data.get("tc_no")
            passport_no = guest_data.get("passport_no")
            
            # Mükerrer misafir yaratmamak için TCKN veya Pasaporta göre getir, yoksa oluştur.
            guest = None
            if tc_no:
                guest = Guest.objects.filter(tc_no=tc_no).first()
            elif passport_no:
                guest = Guest.objects.filter(passport_no=passport_no).first()

            if not guest:
                guest = Guest.objects.create(**guest_data)

            validated_data["guest"] = guest

        if "guest" not in validated_data:
            raise serializers.ValidationError({"guest": "Misafir bilgileri eksiksiz girilmelidir."})

        return super().create(validated_data)