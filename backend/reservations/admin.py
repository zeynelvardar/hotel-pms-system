from django.contrib import admin
from .models import Reservation

@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ("id", "guest", "room", "check_in_date", "check_out_date", "status", "total_price")
    list_filter = ("status", "check_in_date", "check_out_date")
    search_fields = ("guest__first_name", "guest__last_name", "room__room_number")
    autocomplete_fields = ("guest", "room") # N+1'i engellemek için select_related mantığı ile çalışır