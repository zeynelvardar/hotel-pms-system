/**
 * Gerçek Mod10 Algoritması ile TCKN Doğrulama
 * Backend'e gitmeden önce istemci tarafında hatalı girişleri engeller.
 */

export const validateTCKN = (tc) => { //tckn validasyon kontrolü
    if (!tc || !/^[1-9][0-9]{10}$/.test(tc)) return false;

    const digits = tc.split('').map(Number);  // tckno'you alır tek tek array of strings'e çevirir. .map(Number) sayıya dönüştürür.

    // 10. Hane Kuralı: (Tek haneler toplamı * 7 - Çift haneler toplamı) %10
    const sumOdds = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
    const sumEvens = digits[1] + digits[3] + digits[5] + digits[7];
    const d10 = (sumOdds * 7 - sumEvens) % 10;

    if (d10 !== digits[9]) return false;

    // 11. Hane Kuralı: İlk 10 hanenin toplamı %10
    const sumFirst10 = digits.slice(0, 10).reduce((acc, val) => acc + val, 0);
    const d11 = sumFirst10 % 10;

    return d11 === digits[10];
};

export const validatePassport = (passport) => {
    // Basit pasaport validasyonu (Alfanumerik, 7-15 karakter.)
    return /^[A-Z0-9]{7,15}$/i.test(passport);
};
