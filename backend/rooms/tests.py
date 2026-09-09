"""
Rooms ve RoomType API uç noktaları için rol tabanlı yetkilendirme (RBAC),
Room Rack (BFF) ve CRUD operasyonlarını doğrulayan entegrasyon testleri.
"""

from datetime import date
from decimal import Decimal
from typing import Any, cast
from django.urls import reverse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APIClient, APITestCase
from accounts.models import User, UserRole
from rooms.models import Room, RoomStatus, RoomType
from reservations.models import Reservation, ReservationStatus
from guests.models import Guest


class RoomsApiTestCase(APITestCase):
    client: APIClient

    def setUp(self) -> None:
        self.client = APIClient()

        # Admin ve Resepsiyonist kullanıcıları
        self.admin_user = User.objects.create_user(
            username="admin_user",
            email="admin_test@hotel.com",
            password="Password123!",
            role=UserRole.ADMIN,
        )
        self.reception_user = User.objects.create_user(
            username="reception_user",
            email="rec_test@hotel.com",
            password="Password123!",
            role=UserRole.RECEPTION,
        )

        # Temel Oda Tipi ve Örnek Oda
        self.standard_type = RoomType.objects.create(
            name="Standart Oda",
            code="STD",
            base_price=Decimal("1500.00"),
            max_adults=2,
            max_children=1,
        )
        self.room_101 = Room.objects.create(
            room_number="101",
            room_type=self.standard_type,
            floor=1,
            status=RoomStatus.VC,
        )

    def test_receptionist_can_list_rooms_but_cannot_create_room_type(self) -> None:
        """Resepsiyonist odaları okuyabilmeli ama yeni oda tipi ekleyememelidir."""
        self.client.force_authenticate(user=self.reception_user)

        # Okuma başarılı (200)
        list_res = cast(Response, self.client.get(reverse("rooms:room-list")))
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(list_res.data, list)
        self.assertEqual(len(cast(list, list_res.data)), 1)

        # Oda tipi oluşturma yetki hatası vermeli (403)
        create_res = cast(
            Response,
            self.client.post(
                reverse("rooms:room-type-list"),
                {
                    "name": "Deluxe Oda",
                    "code": "DLX",
                    "base_price": "2500.00",
                    "max_adults": 3,
                    "max_children": 1,
                },
                format="json",
            ),
        )
        self.assertEqual(create_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_room_and_room_type(self) -> None:
        """Admin yeni oda tipi ve oda ekleyebilmelidir."""
        self.client.force_authenticate(user=self.admin_user)

        res = cast(
            Response,
            self.client.post(
                reverse("rooms:room-list"),
                {
                    "room_number": "102",
                    "room_type": self.standard_type.pk,
                    "floor": 1,
                    "status": RoomStatus.VC,
                },
                format="json",
            ),
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Room.objects.count(), 2)

    def test_housekeeping_can_change_room_status(self) -> None:
        """Housekeeping personeli odanın statüsünü başarıyla güncelleyebilmelidir."""
        hk_user = User.objects.create_user(
            username="hk_user",
            email="hk@hotel.com",
            password="Password123!",
            role=UserRole.HOUSEKEEPING,
        )
        self.client.force_authenticate(user=hk_user)

        url = reverse("rooms:room-change-status", args=[self.room_101.pk])
        res = cast(
            Response,
            self.client.patch(url, {"status": RoomStatus.VD}, format="json"),
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.room_101.refresh_from_db()
        self.assertEqual(self.room_101.status, RoomStatus.VD)

    def test_housekeeping_cannot_change_room_type(self) -> None:
        """Housekeeping yetkisi sadece statü içindir, oda tipini veya numarasını değiştiremez."""
        hk_user = User.objects.create_user(
            username="hk_user2",
            email="hk2@hotel.com",
            password="Password123!",
            role=UserRole.HOUSEKEEPING,
        )
        self.client.force_authenticate(user=hk_user)

        url = reverse("rooms:room-detail", args=[self.room_101.pk])
        res = cast(
            Response,
            self.client.patch(url, {"room_number": "999"}, format="json"),
        )

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_room_rack_api_returns_grouped_data_without_n_plus_one(self) -> None:
        """Room Rack API'nin katlara göre gruplandığı ve max 2 SQL sorgusu attığı doğrulanır."""
        today = date.today()
        guest = Guest.objects.create(
            first_name="Rack",
            last_name="Tester",
            passport_no="RACK1",
            birth_date=date(1990, 1, 1),
            is_main_guest=True,
        )
        Reservation.objects.create(
            guest=guest,
            room=self.room_101,
            check_in_date=today,
            check_out_date=today,
            total_price=Decimal("100.00"),
            status=ReservationStatus.IN_HOUSE,
        )

        self.client.force_authenticate(user=self.reception_user)
        url = reverse("rooms:room-rack")

        # N+1 Kontrolü: 1 Sorgu Room + 1 Sorgu Reservation/Guest Prefetch = 2 Sorgu
        with self.assertNumQueries(2):
            raw_res = self.client.get(url)

        res = cast(Response, raw_res)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = cast(dict[str, list[dict[str, Any]]], res.data)

        # 1. Kat verisi doğrulaması
        self.assertIn("1", data)
        rooms_on_floor_1 = data["1"]
        room_101_data = next(
            (r for r in rooms_on_floor_1 if r.get("room_number") == self.room_101.room_number),
            None,
        )

        self.assertIsNotNone(room_101_data)
        assert room_101_data is not None  # Pylance statik tip koruması

        active_res = room_101_data.get("active_reservation")
        self.assertIsNotNone(active_res)
        assert active_res is not None

        self.assertEqual(active_res["guest_name"], "Rack Tester")
        self.assertEqual(active_res["status"], ReservationStatus.IN_HOUSE)