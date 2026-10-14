/**
 * ISO tarih stringini (YYYY-MM-DD) kullanıcı dostu DD-MM-YYYY formatına çevirir.
 */
export const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}-${month}-${year}`;
};