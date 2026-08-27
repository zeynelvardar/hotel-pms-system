# Django Admin panelinde Room ve RoomType modellerini liste, 
# arama ve filtreleme özellikleriyle yönetilebilir hale getiren konfigürasyon dosyası.

from django.contrib import admin
from .models import RoomType, Room


@admin.register(RoomType)
class RoomTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "base_price", "max_adults", "max_children", "is_active")
    search_fields = ("name", "code")
    list_filter = ("is_active",)


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("room_number", "room_type", "floor", "status", "is_active")
    list_filter = ("status", "floor", "is_active", "room_type")
    search_fields = ("room_number",)