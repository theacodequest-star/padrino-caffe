# Cinzel Padrino

Cinzel by Natanael Gama (SIL Open Font License 1.1, see OFL.txt), taken from `@fontsource/cinzel` 5.2.8.

Stock Cinzel builds `Đ` and `đ` from the letter plus a macron above it, which reads wrong in Serbian.
The `latin-ext` files here move that bar down across the stem: in the `Dcroat` and `dcroat` composites
the `uni0304` component is placed so its left end starts 75 units left of the stem and its middle sits
at 47% of the letter height. The `latin` files are unchanged. The family is renamed to "Cinzel Padrino"
as the licence asks for modified versions.
