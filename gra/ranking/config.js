/* Ustawienia rankingu — baza Supabase.
   Klucz „publishable” jest przeznaczony do kodu stron: pozwala tylko czytać ranking
   i dopisywać wyniki (zabezpieczenia RLS w bazie). Nigdy nie wpisuj tu klucza secret. */
window.RANKING_CONFIG = {
  url: 'https://vvlwaxuxpwidejnvapkq.supabase.co',
  key: 'sb_publishable_BVRQ5ywySoYSb9AlQlDKJg_462ruMZF',
  table: 'ranking',
  limit: 20,
};
