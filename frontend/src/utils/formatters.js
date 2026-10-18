/**
 * ISO tarih stringini (YYYY-MM-DD) kullanıcı dostu DD-MM-YYYY formatına çevirir.
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}-${month}-${year}`;
};

export const getNextDay = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return '';

    const parts = dateStr.split('-')
    if (parts.length !== 3) return '';

    const [year, month, day] = parts.map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

    const date = new Date(year, month -1, day);
    date.setDate(date.getDate() + 1);

    const nextYear = date.getFullYear();
    const nextMonth = String(date.getMonth() +1 ).padStart(2, '0');
    const nextDay = String(date.getDate()).padStart(2, '0');

    return `${nextYear}-${nextMonth}-${nextDay}`;
};

export const maskDateInput = (value) => {
    // sadece rakamları al, maksimum 8 hane (2 gün + 2 ay + 4 yıl)
    const digits = value.replace(/\D/g, '').slice(0, 8);

    if (digits.length <= 2) {
        return digits;
    }
    if (digits.length <= 4) {
        return `${digits.slice(0, 2)}.${digits.slice(2)}`
    }
    return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
};

export const parseMaskedDateToISO = (maskedDate) => {
    if (!maskedDate || maskedDate.length !== 10) return null;
    const [day, month, year] = maskedDate.split('.')
    if (!day || !month || year.length !== 4) return null;
    return `${year}-${month}-${day}`;
};