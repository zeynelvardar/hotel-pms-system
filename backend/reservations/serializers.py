"""
Rezervasyon modülünün okuma (Dashboard) ve yazma (Create/Update) serializer katmanıdır. 
SoC ve DRY prensipleriyle; 1. misafir, ek misafirler (accompanying_guests),
acenta (agency), oda blokaj (room) ve oda tipi (booked_room_type) işlemleri atomik olarak yönetilir.
"""

from typing import Optional
from rest_framework import serializers
from django.db import transaction
from .models import Reservation, ReservationStatus
from rooms.models import Room, RoomType
from guests.models import Guest
from guests.serializers import GuestSerializer


class DashboardReservationSerializer(serializers.ModelSerializer):
    """
    Resepsiyon panosu için optimize edilmiş salt-okunur (read-only) serializer.
    İlişkili verileri düzleştirerek (flatten) frontend'e hazır hale getirir.
    Floating (Blokajsız) rezervasyonları destekler.
    """
    guest = GuestSerializer(read_only=True)
    guest_full_name = serializers.CharField(source="guest.__str__", read_only=True)
    guest_phone = serializers.CharField(source="guest.phone", read_only=True)
    
    # Blokaj (Fiziksel Oda) - Floating rezervasyonlarda null gelir
    room_number = serializers.CharField(source="room.room_number", read_only=True, allow_null=True)
    
    # Satın Alınan Oda Tipi - Envanter ve Kapasite için zorunludur
    booked_room_type_code = serializers.CharField(source="booked_room_type.code", read_only=True)
    booked_room_type_name = serializers.CharField(source="booked_room_type.name", read_only=True)
    
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    agency_display = serializers.CharField(source="get_agency_display", read_only=True)

    # N+1 olmadan çekilen Ek Misafirler listesi ve kişi sayısı
    accompanying_guests = GuestSerializer(many=True, read_only=True)
    total_guest_count = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = [
            "id",
            "guest",
            "guest_full_name",
            "guest_phone",
            "room_id",
            "room_number",
            "booked_room_type_code",
            "booked_room_type_name",
            "check_in_date",
            "check_out_date",
            "status",
            "status_display",
            "agency",
            "agency_display",
            "total_price",
            "notes",
            "accompanying_guests",
            "total_guest_count",
        ]

    def get_total_guest_count(self, obj: Reservation) -> int:
        # Ana Misafir (1) + eşlik eden diğer misafirler (2., 3... vb.)
        return 1 + obj.accompanying_guests.count()


class ReservationCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Yeni rezervasyon oluşturulurken ve güncellenirken kullanılan yazma (write) serializer'ı.
    Havuzda bekleyen (Floating/Blokajsız) rezervasyonları destekler.
    """
    guest = GuestSerializer(required=False)
    accompanying_guests = GuestSerializer(many=True, required=False)

    # Satın alınan oda tipi (Kapasite ve fiyat için her zaman zorunludur)
    booked_room_type_id = serializers.PrimaryKeyRelatedField(
        queryset=RoomType.objects.all(), source="booked_room_type", required=True
    )

    # Fiziksel oda (Opsiyonel: Rezervasyon havuzda bekleyebilir, odaya atanmayabilir)
    room_id = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.all(), source="room", required=False, allow_null=True
    )

    total_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, default=0.00
    )

    class Meta:
        model = Reservation
        fields = [
            "id",
            "guest",
            "accompanying_guests",
            "booked_room_type_id",
            "room_id",
            "agency",
            "check_in_date",
            "check_out_date",
            "total_price",
            "status",
            "notes",
        ]

    def validate(self, attrs: dict) -> dict:
        """PMS İş Kuralları (Business Logic) Doğrulamaları"""
        status = attrs.get("status", getattr(self.instance, "status", ReservationStatus.RESERVED))
        room = attrs.get("room", getattr(self.instance, "room", None))

        # KURAL 1: İçeride konaklayan (IN_HOUSE) misafir havuzda (blokajsız) bırakılamaz.
        if status == ReservationStatus.IN_HOUSE and not room:
            raise serializers.ValidationError({
                "room_id": "Konaklayan (IN_HOUSE) bir misafirin oda blokajı kaldırılamaz."
            })
            
        return attrs

    def _get_or_update_guests(self, guest_data: dict, is_main_guest: bool = False) -> Optional[Guest]:
        """
        Mükerrer misafir yaratmamak için TCKN veya Pasaporta göre arar,
        varsa günceller, yoksa yeni profil oluşturur (Upsert Mantığı).
        """
        if not guest_data:
            return None

        tc_no = guest_data.get("tc_no")
        passport_no = guest_data.get("passport_no")

        # ID zorunluluğunu ve birincil anahtar çakışmasını önlemek için pop yapıyoruz.
        guest_data.pop("id", None)
        guest_data["is_main_guest"] = is_main_guest

        guest_instance = None
        if tc_no:
            guest_instance = Guest.objects.filter(tc_no=tc_no).first()
        elif passport_no:
            guest_instance = Guest.objects.filter(passport_no=passport_no).first()

        if guest_instance:
            # Mevcut misafir profilini güncel form verileriyle senkronize et
            for attr, value in guest_data.items():
                setattr(guest_instance, attr, value)
            guest_instance.save()
            return guest_instance
        else:
            # Yeni misafir yarat
            return Guest.objects.create(**guest_data)

    @transaction.atomic
    def create(self, validated_data: dict) -> Reservation:
        guest_data = validated_data.pop("guest", None)
        accompanying_guests_data = validated_data.pop("accompanying_guests", [])

        if not guest_data:
            raise serializers.ValidationError({"guest": "Ana misafir bilgileri eksiksiz girilmelidir."})

        # 1. Ana Misafiri İşle
        main_guest = self._get_or_update_guests(guest_data, is_main_guest=True)
        validated_data["guest"] = main_guest

        # 2. Rezervasyonu oluştur (Fiziksel room_id null olabilir, sorun yok)
        reservation = super().create(validated_data)

        # 3. Ek Misafirleri İşle
        if accompanying_guests_data:
            acc_guests = []
            for acc_data in accompanying_guests_data:
                acc_guest = self._get_or_update_guests(acc_data, is_main_guest=False)
                if acc_guest and acc_guest.id != main_guest.id:
                    acc_guests.append(acc_guest)

            if acc_guests:
                reservation.accompanying_guests.set(acc_guests)

        return reservation

    @transaction.atomic
    def update(self, instance: Reservation, validated_data: dict) -> Reservation:
        guest_data = validated_data.pop("guest", None)
        accompanying_guests_data = validated_data.pop("accompanying_guests", None)

        # 1. Ana Misafiri Güncelle (veri geldiyse)
        if guest_data:
            main_guest = self._get_or_update_guests(guest_data, is_main_guest=True)
            validated_data["guest"] = main_guest

        # 2. Rezervasyon verilerini güncelle (Oda Blokajı dahil)
        reservation = super().update(instance, validated_data)

        # 3. Ek Misafir Listesini Güncelle
        if accompanying_guests_data is not None:
            acc_guests = []
            for acc_data in accompanying_guests_data:
                acc_guest = self._get_or_update_guests(acc_data, is_main_guest=False)
                if acc_guest and acc_guest.id != reservation.guest_id:
                    acc_guests.append(acc_guest)

            # Listeyi tamamen yenile
            reservation.accompanying_guests.set(acc_guests)

        return reservation