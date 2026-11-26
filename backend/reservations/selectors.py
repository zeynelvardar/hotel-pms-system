"""
Rezervasyon Salt-Okunur Sorgu Katmanı (Selector Pattern / CQRS-lite)

Ne Yapar?
- Operasyon panosunun (Dashboard) sekme bazlı rezervasyon listelerini, 8 sütunluk
  server-side yazarak arama filtrelerini, güvenli dinamik sıralamasını ve 4 günlük
  operasyon sekmesinin anlık sayaçlarını üretir.

Neyi Çözer?
- Yazma/iş kuralı katmanı olan 'services.py' dosyasının okuma sorgularıyla şişmesini önler (SRP).
- 100'lü sayfalama ve sonsuz kaydırma (Infinite Scroll) sırasında client-side aramanın
  eksik sonuç üretmesini ve N+1 sorgu problemini tamamen ortadan kaldırır.
- Aynı tarihteki yoğun kayıtlarda PostgreSQL OFFSET/LIMIT kaymasıyla oluşan tekrar/kayıp
  satır sorununu deterministik 'id' ikincil anahtarıyla engeller.
"""

from datetime import date, datetime
from enum import StrEnum
from typing import Mapping, Optional

from django.db.models import CharField, Count, Q, QuerySet, TextChoices
from django.db.models.functions import Cast # bir veri tipini başka tipe dönüştürmeye yarayan DRF methodu.
from django.utils.dateparse import parse_date

from rooms.models import RoomStatus
from .models import HotelSettings, Reservation, ReservationAgency, ReservationStatus


class DashboardTab(StrEnum):
    """ Operasyon panosundaki geçerli sekme anahtarları """
    ARRIVALS = "arrivals"
    ARRIVED_TODAY = "arrived-today"
    IN_HOUSE = "in-house"
    DEPARTURES = "departures"
    RESERVATIONS = "reservations"
    CHECKED_OUT = "checked-out"
    CANCELLED = "cancelled"
    ALL_RECORDS = "all-records"


# Python'ın standart .lower() metodu 'İ' harfini iki karakterli (i + combining dot) ürettiği için
# Türkçe TextChoices etiket eşleştirmelerinde açık çeviri tablosu kullanılır.
_TR_LOWER_TABLE = str.maketrans("İIĞÜŞÖÇ", "iığüşöç")


def _normalize_tr(text: str) -> str:
    return text.translate(_TR_LOWER_TABLE).lower()

def _parse_safe_date(raw_value: Optional[str]) -> Optional[date]:
    """
    ISO (YYYY-MM-DD) veya Türkçe (GG.AA.YYYY / GG-AA-YYYY) tarihleri güvenli ayrıştırır.
    Kullanıcı yazarken gelen yarım/geçersiz değerlerde hata fırlatmak yerine None döner.
    """
    if not raw_value:
        return None

    cleaned = raw_value.strip()
    if not cleaned:
        return None

    parsed_iso = parse_date(cleaned)
    if parsed_iso:
        return parsed_iso

    for fmt in ("%d.%m.%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None

def _normalize_balance_query(raw_value: str) -> str:
    """
    '₺1.500,50', '1.500' veya '1500,5' gibi Türkçe para girişlerini PostgreSQL'in
    Decimal -> VARCHAR ('1500.50') formatıyla eşleşecek biçime dönüştürür.
    """
    cleaned = (
        raw_value.replace("₺", "")
        .replace("TL", "")
        .replace("tl", "")
        .replace(" ", "")
        .strip()
    )
    if not cleaned:
        return ""

    if "." in cleaned and "," in cleaned:
        return cleaned.replace(".", "").replace(",", ".")

    if "," in cleaned:
        return cleaned.replace(",", ".")

    if "." in cleaned:
        parts = cleaned.split(".")
        # Nokta sonrası parçaların tamamı 3 haneli rakamsa (örn: 1.500 veya 1.250.000) binlik ayracıdır.
        if len(parts) > 1 and all(len(part) == 3 and part.isdigit() for part in parts[1:]):
            return "".join(parts)

    return cleaned

def _build_choices_search_q( # GÖREVİ: KULLANICININ ARAMA KUTUSUNA YAZDIĞI KELİMEYİ HEM İNGİLİZCE HEM TÜRKÇE ETİKETLER İÇİNDE AYNI ANDA ARAYABİLEN, AKILLI VE ESNEK BİR ARAMA FİLTRESİ ÜRETMEK.
        field_name: str, # 1. Hangi veritabanı sütununda arama yapılacak? (Örn: "status")
        choices_cls: type[TextChoices], # 2. Hangi Seçenek sınıfı incelenecek? (İngilizce kod ve Türkçe etiketleri tutan Django TextChoices sınıfı)
        raw_term: str, # 3. Kullanıcının arama kutusuna yazdığı ham metin.
) -> Q: # Geriye Django'nun filtreleme yapabilmesi için bir Q nesnesi döndürür.
    """
    Veritabanında İngilizce kod (DIRECT, VC, IN_HOUSE) tutulurken ekranda Türkçe etiket
    görünen alanlar için hem kod hem etiket üzerinden hibrit arama Q objesi üretir.
    """
    term = raw_term.strip() # ham metni temizler.
    normalized_term = _normalize_tr(term) # büyük TR harfleri küçültür.

    matched_values = [ # Etiketlerin İngilizce Hali (gelen verinin türkçe karakter kontrollerinden sonra)
        value
        for value, label in choices_cls.choices
        if normalized_term in _normalize_tr(str(value))
        or normalized_term in _normalize_tr(str(label))
    ]

    query = Q(**{f"{field_name}__icontains": term})
    if matched_values:
        query |= Q(**{f"{field_name}__in": matched_values})

    return query

def _get_tab_filters(current_date: date) -> dict[DashboardTab, Q]:
    """
    Tek Doğruluk Kaynağı (DRY):
    Hem liste sorgusu hem 4'lü operasyon sayaç sorgusu aynı sekme kurallarını buradan okur.
    """
    return {
        DashboardTab.ARRIVALS: Q(
            status=ReservationStatus.RESERVED,
            check_in_date=current_date,
        ),
        DashboardTab.ARRIVED_TODAY: Q(
            status=ReservationStatus.IN_HOUSE,
            check_in_date=current_date,
        ),
        DashboardTab.IN_HOUSE: Q(
            status=ReservationStatus.IN_HOUSE,
        ),
        DashboardTab.DEPARTURES: Q(
            status=ReservationStatus.IN_HOUSE,
            check_out_date=current_date,
        ),
        DashboardTab.RESERVATIONS: Q(
            status=ReservationStatus.RESERVED,
            check_in_date__gte=current_date,
        ),
        DashboardTab.CHECKED_OUT: Q(
            status=ReservationStatus.CHECKED_OUT,
        ),
        DashboardTab.CANCELLED: Q(
            status__in=[ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW],
        ),
        DashboardTab.ALL_RECORDS: Q(),
    }

class ReservationDashBoardSelector:
    """
    Tekil Dashboard uç noktası için sekme yönlendirme, 8 sütunlu dinamik filtreleme
    ve whitelist korumalı deterministik sıralama sağlayan sorgu sınıfı.
    """

    # Sekme bazlı varsayılan sıralamalar (her biri benzersiz 'id' tie-breaker içerir.)
    DEFAULT_TAB_ORDERING: dict[DashboardTab, tuple[str, ...]] = {
        DashboardTab.CHECKED_OUT: ("-check_out_date", "-id"),
        DashboardTab.CANCELLED: ("-updated_at", "id"),
        DashboardTab.ALL_RECORDS: ("-id",),
    }
    FALLBACK_ORDERING: tuple[str, ...] = ("check_in_date", "id")

    ALLOWED_ORDERING_MAP: dict[str, tuple[str, ...]] = {
        "guest": ("guest__first_name", "guest__last_name"),
        "room_number": ("room__room_number",),
        "room_status": ("room__status",),
        "check_in": ("check_in_date",),
        "check_in_date": ("check_in_date",),
        "check_out": ("check_out_date",),
        "check_out_date": ("check_out_date",),
        "balance": ("total_price",),
        "total_price": ("total_price",),
        "status": ("status",),
        "agency": ("agency",),
        "updated_at": ("updated_at",),
        "id": ("id",),
    }

    @classmethod
    def get_base_queryset(cls) -> QuerySet[Reservation]:
        """
        N+1 Korumalı temel sorgu:
        100 satırlık sayfalarda dahi tüm ilişkili nesneler tek JOIN ve tek prefetch ile çekilir.
        """
        return Reservation.objects.select_related(
            "guest",
            "room",
            "room__room_type",
            "booked_room_type",
        ).prefetch_related("accompanying_guests")

    @classmethod
    def _resolve_tab(cls, raw_tab: Optional[str]) -> DashboardTab:
        cleaned = (raw_tab or DashboardTab.ALL_RECORDS).strip().lower()
        try:
            return DashboardTab(cleaned)
        except ValueError as exc:
            valid_tabs = ", ".join(tab.value for tab in DashboardTab)
            raise ValueError(
                f"Geçersiz sekme parametresi: '{raw_tab}'. Geçerli değerler: {valid_tabs}"
            ) from exc

    @classmethod
    def _apply_column_filters(
        cls,
        qs: QuerySet[Reservation], # açık olan sekmenin veri havuzu
        filters: Mapping[str, str] # gelen ham filtre verisi
    ) -> QuerySet[Reservation]:
        # 1. MİSAFİR (Çoklu kelime destekli AND zinciri: Ad + Soyad + TC + Pasaport)
        guest_query = (filters.get("guest") or "").strip()
        if guest_query:
            for token in guest_query.split():
                qs = qs.filter(
                    Q(guest__first_name__icontains=token)
                    | Q(guest__last_name__icontains=token)
                    | Q(guest__tc_no__icontains=token)
                    | Q(guest__passport_no__icontains=token)
                )

        # 2. ODA NUMARASI
        room_number = (filters.get("room_number") or "").strip()
        if room_number:
            qs = qs.filter(room__room_number__icontains=room_number)

        # 3. ODA DURUMU (Kod + Türkçe/İngilizce etiket hibrit arama)
        room_status = (filters.get("room_status") or "").strip()
        if room_status:
            qs = qs.filter(_build_choices_search_q("room__status", RoomStatus, room_status))

        # 4. CHECK-IN TARİHİ (ISO ve GG.AA.YYYY destekli, geçersiz girişte sessiz koruma)
        check_in_raw = filters.get("check_in") or filters.get("check_in_date")
        check_in_date = _parse_safe_date(check_in_raw)
        if check_in_date:
            qs = qs.filter(check_in_date=check_in_date)

        # 5. CHECK-OUT TARİHİ
        check_out_raw = filters.get("check_out") or filters.get("check_out_date")
        check_out_date = _parse_safe_date(check_out_raw)
        if check_out_date:
            qs = qs.filter(check_out_date=check_out_date)

        # 6. BAKİYE (Yalnızca parametre doluysa Cast uygulanır; normal sorgulara yük bindirmez.)
        balance_raw = (filters.get("balance") or filters.get("total_price") or "").strip()
        if balance_raw:
            normalized_balance = _normalize_balance_query(balance_raw)
            if normalized_balance:
                qs = qs.annotate(
                    total_price_str=Cast("total_price", output_field=CharField())
                ).filter(total_price_str__icontains=normalized_balance)

        # 7. REZERVASYON STATÜSÜ (Kod + Türkçe etiket hibrit arama)
        status_query = (filters.get("status") or "").strip()
        if status_query:
            qs = qs.filter(_build_choices_search_q("status", ReservationStatus, status_query))

        # 8. ACENTA / SATIŞ KANALI (Yüzlerce acenta ve Türkçe etiket için hibrit yazarak arama)
        agency_query = (filters.get("agency") or "").strip()
        if agency_query:
            qs = qs.filter(_build_choices_search_q("agency", ReservationAgency, agency_query))

        return qs

    @classmethod
    def _resolve_ordering( # ham sıralama isteğini, django sıralama demetinde dönüştürür.
        cls,
        tab: DashboardTab,
        raw_ordering: Optional[str],
    ) -> tuple[str, ...]:
        cleaned = (raw_ordering or "").strip()
        if not cleaned:
            return cls.DEFAULT_TAB_ORDERING.get(tab, cls.FALLBACK_ORDERING)

        is_desc = cleaned.startswith("-")
        field_key = cleaned[1:] if is_desc else cleaned
        mapped_fields = cls.ALLOWED_ORDERING_MAP.get(field_key)

        if not mapped_fields:
            return cls.DEFAULT_TAB_ORDERING.get(tab, cls.FALLBACK_ORDERING)

        order_fields = [f"-{field}" if is_desc else field for field in mapped_fields]

        # Deterministik OFFSET/LIMIT sayfalaması için benzersiz 'id' tie-breaker zorunludur.
        if "id" not in mapped_fields:
            order_fields.append("-id" if is_desc else "id")

        return tuple(order_fields)

    @classmethod
    def get_queryset(
        cls,
        tab: Optional[str] = None,
        filters: Optional[Mapping[str, str]] = None,
        ordering: Optional[str] = None,
    ) -> QuerySet[Reservation]:
        """
        Verilen sekme, sütun filtreleri ve sıralama kriterlerine göre lazy QuerySet döner.
        Sayfalama (LIMIT/OFFSET ve COUNT) üst katmandaki DRF pagination tarafından uygulanır.
        """
        resolved_tab = cls._resolve_tab(tab)
        current_date = HotelSettings.get_current_date()
        tab_q = _get_tab_filters(current_date)[resolved_tab]

        qs = cls.get_base_queryset()
        if tab_q:
            qs = qs.filter(tab_q)

        if filters:
            qs = cls._apply_column_filters(qs, filters)

        order_by_fields = cls._resolve_ordering(resolved_tab, ordering)
        return qs.order_by(*order_by_fields)


class DashboardCountSelector:
    """
    Yalnızca günlük ön büro iş yükünü gösteren 4 operasyonel sekmenin sayılarını
    PostgreSQL Conditional Aggregation ile tek SQL sorgusunda (sıfır JOIN) hesaplar.
    """

    @staticmethod
    def get_operational_counts() -> dict[str, int]:
        current_date = HotelSettings.get_current_date()
        tab_filters = _get_tab_filters(current_date)

        aggregated = Reservation.objects.aggregate(
            arrivals=Count("id", filter=tab_filters[DashboardTab.ARRIVALS]),
            arrived_today=Count("id", filter=tab_filters[DashboardTab.ARRIVED_TODAY]),
            in_house=Count("id", filter=tab_filters[DashboardTab.IN_HOUSE]),
            departures=Count("id", filter=tab_filters[DashboardTab.DEPARTURES]),
        )

        # Frontend sekme anahtarıyla birebir eşleşen sözlük formatı
        return {
            DashboardTab.ARRIVALS.value: aggregated["arrivals"] or 0,
            DashboardTab.ARRIVED_TODAY.value: aggregated["arrived_today"] or 0,
            DashboardTab.IN_HOUSE.value: aggregated["in_house"] or 0,
            DashboardTab.DEPARTURES.value: aggregated["departures"] or 0,
        }