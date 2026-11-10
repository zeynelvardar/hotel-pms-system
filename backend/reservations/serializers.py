"""
Rezervasyon modülünün okuma (Dashboard) ve yazma (Create/Update) serializer katmanıdır. 
SoC ve DRY prensipleriyle; 1. misafir, 2. ve 3. misafirler (accompanying_guests),
acenta (agency) ve çakışma önleyici atomik işlemler burada yönetilir.
"""

from typing import Optional
from rest_framework import serializers
from django.db import transaction
from .models import Reservation
from rooms.models import Room
from guests.models import Guest
from guests.serializers import GuestSerializer


class DashboardReservationSerializer(serializers.ModelSerializer):
    """
    Resepsiyon panosu için optimize edilmiş salt-okunur (read-only) serializer.
    İlişkili verileri düzleştirerek (flatten) frontend'e hazır hale getirir.
    """
    guest = GuestSerializer(read_only=True)
    guest_full_name = serializers.CharField(source="guest.__str__", read_only=True)
    guest_phone = serializers.CharField(source="guest.phone", read_only=True)
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    room_type_code = serializers.CharField(source="room.room_type_code", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    agency_display = serializers.CharField(source="get_agency_display", read_only=True)

    # N+1 olmadan çekilen Ek Misafirler listesi ve kişi sayısı
    accompanying_guests = GuestSerializer(many=True, read_only=True)
    total_guest_count = serializers.SerializerMethodField()  # get_total_guest_count metodunu arar

    class Meta:
        model = Reservation
        fields = [
            "id",
            "guest",
            "guest_full_name",
            "guest_phone",
            "room_number",
            "room_type_code",
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
    Yeni rezervasyon oluşturulurken ve Rezervasyon Kartı güncellenirken, 
    hem ana misafiri hem de ek misafirleri (nested) güvenle işleyen yazma serializer'ı.
    """
    guest = GuestSerializer(required=False)
    accompanying_guests = GuestSerializer(many=True, required=False)

    # Frontend ile backend arasında oda gibi ilişkisel verileri ID'ler üzerinden konuşarak,
    # güvenli ve hatasız birbirine bağlayan bir tercümandır.
    room_id = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.all(), source="room", required=False
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
            "room_id",
            "agency",
            "check_in_date",
            "check_out_date",
            "total_price",
            "status",
            "notes",
        ]

    def validate(self, attrs: dict) -> dict:
        if "room" not in attrs and not self.instance:
            raise serializers.ValidationError({"room": "Bir oda seçilmelidir"})
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
        guest_data = validated_data.pop("guest", None)  # validated_data'dan misafir bilgisini söküp alıyoruz.
        accompanying_guests_data = validated_data.pop("accompanying_guests", [])  # Beraberindeki misafirleri söküp alıyoruz.

        if not guest_data:
            raise serializers.ValidationError({"guest": "Ana misafir bilgileri eksiksiz girilmelidir."})

        # 1. Ana Misafiri İşle
        main_guest = self._get_or_update_guests(guest_data, is_main_guest=True)
        validated_data["guest"] = main_guest  # Veritabanından aldığımız model nesnesini Foreign Key için geri koyar.

        # Rezervasyonu oluştur.
        reservation = super().create(validated_data)  # create fonksiyonu çalıştıktan sonraki nesneyi reservation değişkenine atıyoruz.

        # 2. Ek Misafirleri İşle (varsa 2. ve 3. kişiler)
        if accompanying_guests_data:
            acc_guests = []
            for acc_data in accompanying_guests_data:
                acc_guest = self._get_or_update_guests(acc_data, is_main_guest=False)
                # Aynı kişiyi hem 1. hem 2. misafir yapmasını engelle.
                if acc_guest and acc_guest.id != main_guest.id:
                    acc_guests.append(acc_guest)

            if acc_guests:
                reservation.accompanying_guests.set(acc_guests)

        return reservation

    @transaction.atomic
    def update(self, instance: Reservation, validated_data: dict) -> Reservation:
        guest_data = validated_data.pop("guest", None)  # guest anahtarını bul, guest_data değişkenine ata
        accompanying_guests_data = validated_data.pop("accompanying_guests", None)

        # 1. Ana Misafiri Güncelle (veri geldiyse)
        if guest_data:
            main_guest = self._get_or_update_guests(guest_data, is_main_guest=True)
            validated_data["guest"] = main_guest  # Güncellenen model nesnesi Foreign Key için validated_data içine geri koyulur.

        # Rezervasyon verilerini güncelle (Oda, Tarih, Acenta vb.)
        reservation = super().update(instance, validated_data)

        # 2. Ek Misafir Listesini Güncelle
        if accompanying_guests_data is not None:
            acc_guests = []
            for acc_data in accompanying_guests_data:
                acc_guest = self._get_or_update_guests(acc_data, is_main_guest=False)
                # 2. kişi 1. kişi ile aynı mı kontrolü
                if acc_guest and acc_guest.id != reservation.guest_id:
                    acc_guests.append(acc_guest)

            # Listeyi yeniden set et (silinenler listeden düşer, yeniler eklenir)
            reservation.accompanying_guests.set(acc_guests)

        return reservation