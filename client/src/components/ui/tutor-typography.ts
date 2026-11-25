// Tipografia compartida de los textos secundarios del tutor: tarjeta de /tutors (TutorListItem)
// y panel lateral de detalle (TutorProfileContent). Un solo lugar = mismo tamano, peso y color
// en ambos. Escala: tokens responsivos text-body / text-caption (suben a 16 / 14px desde 768px);
// colores gray-700 (texto secundario) y primary-700 (calificacion), todos tokens de index.css.
export const tutorTypography = {
  /** Profesion bajo el nombre ("Ingenieria Industrial"). */
  profession: "text-caption md:text-label font-normal text-gray-700",
  /** Metadata: "0 completados", separadores, conteos. */
  meta: "text-caption md:text-label font-normal text-gray-700",
  /** Valor de un dato del perfil (profesion, universidad, email, telefono, pais, titulo de un ajuste). Peso normal. */
  value: "text-body font-normal text-gray-900",
  /** Dato vacio ("Sin registrar..."): mas tenue que un dato real, nunca mas pesado. */
  empty: "text-body font-normal italic text-gray-700",
  /** Descripcion del tutor (bio): perfil propio, panel de detalle, modal, drawer del chat y favoritos. */
  bio: "text-body font-normal text-gray-700",
  /** Calificacion numerica ("5.0 (9)"). */
  rating: "text-caption md:text-label font-medium text-primary-700",
} as const;
