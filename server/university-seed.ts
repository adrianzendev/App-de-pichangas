// Lista inicial del catalogo de universidades (tabla `universities`). Se carga UNA vez al arrancar, solo si la tabla esta vacia
// (ver server/index.ts); despues la mantiene el admin en /dashboard/universities. Son universidades de los paises donde ya hay
// cuentas (Peru, Venezuela, Colombia, Mexico, Ecuador) y las que los usuarios ya habian escrito a mano.

export const UNIVERSITY_SEED: ReadonlyArray<readonly [name: string, country: string, acronym: string]> = [
  // Peru
  ["Pontificia Universidad Católica del Perú", "PE", "PUCP"],
  ["Universidad Nacional Mayor de San Marcos", "PE", "UNMSM"],
  ["Universidad Nacional de Ingeniería", "PE", "UNI"],
  ["Universidad Peruana Cayetano Heredia", "PE", "UPCH"],
  ["Universidad de Lima", "PE", "ULima"],
  ["Universidad del Pacífico", "PE", "UP"],
  ["Universidad ESAN", "PE", "ESAN"],
  ["Universidad Peruana de Ciencias Aplicadas", "PE", "UPC"],
  ["Universidad Tecnológica del Perú", "PE", "UTP"],
  ["Universidad Católica Santo Toribio de Mogrovejo", "PE", "USAT"],
  ["Universidad San Martín de Porres", "PE", "USMP"],
  ["Universidad Privada del Norte", "PE", "UPN"],
  ["Universidad César Vallejo", "PE", "UCV"],
  ["Universidad Continental", "PE", "UC"],
  ["Universidad Nacional Agraria La Molina", "PE", "UNALM"],
  ["Universidad Nacional de San Antonio Abad del Cusco", "PE", "UNSAAC"],
  ["Universidad Nacional de San Agustín de Arequipa", "PE", "UNSA"],
  ["Universidad Nacional de Trujillo", "PE", "UNT"],
  ["Universidad Nacional del Altiplano", "PE", "UNA Puno"],
  // Venezuela
  ["Universidad Central de Venezuela", "VEN", "UCV"],
  ["Universidad del Zulia", "VEN", "LUZ"],
  ["Universidad Fermín Toro", "VEN", "UFT"],
  ["Universidad de Los Andes (Mérida)", "VEN", "ULA"],
  ["Universidad Simón Bolívar", "VEN", "USB"],
  ["Universidad Católica Andrés Bello", "VEN", "UCAB"],
  ["Universidad de Carabobo", "VEN", "UC"],
  ["Universidad Metropolitana", "VEN", "Unimet"],
  ["Universidad Santa María", "VEN", "USM"],
  // Colombia
  ["Universidad Nacional de Colombia", "CO", "UNAL"],
  ["Universidad de los Andes (Bogotá)", "CO", "Uniandes"],
  ["Pontificia Universidad Javeriana", "CO", "PUJ"],
  ["Universidad de Antioquia", "CO", "UdeA"],
  ["Universidad de Nariño", "CO", "UDENAR"],
  ["Universidad de Pamplona", "CO", "Unipamplona"],
  // Mexico
  ["Universidad Nacional Autónoma de México", "MX", "UNAM"],
  ["Universidad Autónoma del Estado de México", "MX", "UAEMéx"],
  // Ecuador
  ["Escuela Politécnica Nacional", "EC", "EPN"],
  ["Universidad Central del Ecuador", "EC", "UCE"],
  ["Universidad San Francisco de Quito", "EC", "USFQ"],
];

/** INSERT de la lista inicial; no hace nada si la tabla ya tiene alguna universidad (el admin la gestiona). */
export function universitySeedSql(): string {
  const q = (v: string) => v.replace(/'/g, "''");
  const values = UNIVERSITY_SEED.map(([name, country, acronym]) => `('${q(name)}', '${country}', '${q(acronym)}')`).join(",\n    ");
  return `INSERT INTO universities (name, country, acronym)
  SELECT v.name, v.country, v.acronym FROM (VALUES
    ${values}
  ) AS v(name, country, acronym)
  WHERE NOT EXISTS (SELECT 1 FROM universities)`;
}

/** Completa las siglas de las universidades de la lista inicial que aun no tienen (no pisa las que el admin ya escribio). */
export function universityAcronymBackfillSql(): string {
  const q = (v: string) => v.replace(/'/g, "''");
  const values = UNIVERSITY_SEED.map(([name, , acronym]) => `('${q(name)}', '${q(acronym)}')`).join(",\n    ");
  return `UPDATE universities u SET acronym = v.acronym
  FROM (VALUES
    ${values}
  ) AS v(name, acronym)
  WHERE u.name = v.name AND (u.acronym IS NULL OR u.acronym = '')`;
}

// Ampliacion a 20 universidades por pais (Peru, Chile, Ecuador, Colombia). Se agrega UNA vez: solo si aun no existe "Universidad de Chile"
// (marca de que ya se cargo); asi, si el admin borra alguna despues, no vuelve a aparecer al reiniciar.
export const UNIVERSITY_EXTRA: ReadonlyArray<readonly [name: string, country: string, acronym: string]> = [
  // Peru (19 -> 20)
  ["Universidad Nacional Federico Villarreal", "PE", "UNFV"],
  // Chile (0 -> 20)
  ["Pontificia Universidad Católica de Chile", "CL", "UC"],
  ["Universidad de Chile", "CL", "UChile"],
  ["Universidad de Santiago de Chile", "CL", "USACH"],
  ["Universidad de Concepción", "CL", "UdeC"],
  ["Universidad Técnica Federico Santa María", "CL", "UTFSM"],
  ["Universidad Austral de Chile", "CL", "UACh"],
  ["Universidad de Valparaíso", "CL", "UV"],
  ["Universidad Adolfo Ibáñez", "CL", "UAI"],
  ["Universidad de los Andes (Chile)", "CL", "UANDES"],
  ["Universidad Diego Portales", "CL", "UDP"],
  ["Pontificia Universidad Católica de Valparaíso", "CL", "PUCV"],
  ["Universidad Católica del Norte", "CL", "UCN"],
  ["Universidad de Talca", "CL", "UTalca"],
  ["Universidad de La Frontera", "CL", "UFRO"],
  ["Universidad de Antofagasta", "CL", "UA"],
  ["Universidad Mayor", "CL", "UMayor"],
  ["Universidad Andrés Bello", "CL", "UNAB"],
  ["Universidad del Desarrollo", "CL", "UDD"],
  ["Universidad Alberto Hurtado", "CL", "UAH"],
  ["Universidad de Tarapacá", "CL", "UTA"],
  // Ecuador (3 -> 20)
  ["Pontificia Universidad Católica del Ecuador", "EC", "PUCE"],
  ["Escuela Superior Politécnica del Litoral", "EC", "ESPOL"],
  ["Universidad de Guayaquil", "EC", "UG"],
  ["Universidad de Cuenca", "EC", "UCuenca"],
  ["Universidad del Azuay", "EC", "UDA"],
  ["Universidad Politécnica Salesiana", "EC", "UPS"],
  ["Universidad de las Fuerzas Armadas ESPE", "EC", "ESPE"],
  ["Universidad Técnica Particular de Loja", "EC", "UTPL"],
  ["Universidad Católica de Santiago de Guayaquil", "EC", "UCSG"],
  ["Universidad Técnica de Ambato", "EC", "UTA"],
  ["Universidad Técnica del Norte", "EC", "UTN"],
  ["Universidad Laica Eloy Alfaro de Manabí", "EC", "ULEAM"],
  ["Universidad de Especialidades Espíritu Santo", "EC", "UEES"],
  ["Universidad Casa Grande", "EC", "UCG"],
  ["Universidad Estatal de Milagro", "EC", "UNEMI"],
  ["Universidad Nacional de Chimborazo", "EC", "UNACH"],
  ["Universidad Técnica de Manabí", "EC", "UTM"],
  // Colombia (6 -> 20)
  ["Universidad del Rosario", "CO", "UR"],
  ["Universidad Externado de Colombia", "CO", "UEC"],
  ["Universidad de La Sabana", "CO", "Unisabana"],
  ["Universidad EAFIT", "CO", "EAFIT"],
  ["Universidad Pontificia Bolivariana", "CO", "UPB"],
  ["Universidad del Valle", "CO", "Univalle"],
  ["Universidad Industrial de Santander", "CO", "UIS"],
  ["Universidad del Norte", "CO", "Uninorte"],
  ["Universidad Santo Tomás", "CO", "USTA"],
  ["Universidad Libre", "CO", "Unilibre"],
  ["Universidad Distrital Francisco José de Caldas", "CO", "UDistrital"],
  ["Universidad Tecnológica de Pereira", "CO", "UTP"],
  ["Universidad de Cartagena", "CO", "UdeC"],
  ["Universidad del Cauca", "CO", "Unicauca"],
];

/** INSERT de la ampliacion; no hace nada si ya se cargo (existe "Universidad de Chile") y no repite nombres. */
export function universityExtraSql(): string {
  const q = (v: string) => v.replace(/'/g, "''");
  const values = UNIVERSITY_EXTRA.map(([name, country, acronym]) => `('${q(name)}', '${country}', '${q(acronym)}')`).join(",\n    ");
  return `INSERT INTO universities (name, country, acronym)
  SELECT v.name, v.country, v.acronym FROM (VALUES
    ${values}
  ) AS v(name, country, acronym)
  WHERE NOT EXISTS (SELECT 1 FROM universities WHERE lower(name) = 'universidad de chile')
    AND NOT EXISTS (SELECT 1 FROM universities x WHERE lower(x.name) = lower(v.name))`;
}
