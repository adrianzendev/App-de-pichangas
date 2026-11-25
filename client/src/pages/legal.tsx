import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { BackButton } from "@/components/ui/back-button";
import { Container } from "@/components/ui/Container";
import { ROUTES } from "@/lib/routes";
import { SUPPORT_PHONE_LABEL, SUPPORT_URL } from "@/lib/support";

// Paginas publicas (sin sesion): las tiendas piden una URL de politica de privacidad y de terminos.
// Texto base a revisar con asesoria legal antes de publicar en las tiendas.
const UPDATED = "20 de octubre de 2026";

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  const [, setLocation] = useLocation();
  const goBack = () => (window.history.length > 1 ? window.history.back() : setLocation(ROUTES.root));
  return (
    <main className="min-h-dvh bg-white pb-12 pt-safe-top">
      <Container className="space-y-6 py-page-top">
        <div className="flex items-center gap-2">
          <BackButton onClick={goBack} />
          <h1 className="text-heading font-bold text-gray-900">{title}</h1>
        </div>
        <p className="text-caption text-gray-700">Última actualización: {UPDATED}</p>
        {children}
      </Container>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-subheading font-semibold text-gray-900">{title}</h2>
      <div className="space-y-2 text-body text-gray-700">{children}</div>
    </section>
  );
}

function Contact() {
  return (
    <p>
      Escríbenos por WhatsApp al{" "}
      <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-600 hover:underline">
        {SUPPORT_PHONE_LABEL}
      </a>
      .
    </p>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidad">
      <Section title="1. Quiénes somos">
        <p>Mil Tareas conecta a alumnos con tutores para recibir ayuda académica. Esta política explica qué datos tratamos y por qué.</p>
      </Section>
      <Section title="2. Datos que recopilamos">
        <p>Datos de la cuenta: nombre, correo, país, WhatsApp, universidad y foto de perfil (opcional). Si usas Google, recibimos tu nombre, correo y foto.</p>
        <p>Datos de uso del servicio: pedidos que publicas, mensajes y archivos adjuntos, ofertas, calificaciones y comprobantes de pago que subes.</p>
        <p>Datos técnicos: dispositivo, navegador, país aproximado por IP y, si activas los avisos, el identificador de tu dispositivo para notificaciones.</p>
      </Section>
      <Section title="3. Para qué los usamos">
        <p>Para crear tu cuenta, mostrarte tutores y pedidos, permitir la comunicación entre alumno y tutor, verificar pagos, enviarte avisos del servicio, prevenir fraude y abuso, y mejorar la aplicación.</p>
      </Section>
      <Section title="4. Con quién los compartimos">
        <p>El tutor o alumno con quien interactúas ve tu nombre, foto y los mensajes y archivos que le envías. No vendemos tus datos.</p>
        <p>Usamos proveedores que tratan datos por encargo nuestro: autenticación (Supabase), base de datos y almacenamiento de archivos, envío de correos, notificaciones push (Google Firebase Cloud Messaging y Apple Push Notification service) y analítica (Meta Pixel y Microsoft Clarity).</p>
      </Section>
      <Section title="5. Conservación">
        <p>Conservamos tus datos mientras tengas la cuenta. Si la eliminas, borramos tus datos personales (nombre, correo, teléfono, foto, dispositivos). Los pedidos, pagos y mensajes compartidos con otra persona se conservan sin tu identidad para no alterar su historial ni nuestras obligaciones contables.</p>
      </Section>
      <Section title="6. Tus derechos">
        <p>Puedes acceder, corregir y eliminar tus datos. Para eliminar tu cuenta usa la opción «Eliminar cuenta» en el menú de tu perfil, o entra en esta dirección: /delete-account.</p>
        <Contact />
      </Section>
      <Section title="7. Menores">
        <p>El servicio está dirigido a mayores de 18 años y a estudiantes universitarios. No recopilamos a sabiendas datos de menores de 13 años.</p>
      </Section>
      <Section title="8. Cambios">
        <p>Si cambiamos esta política publicaremos la nueva versión en esta página con su fecha de actualización.</p>
      </Section>
    </LegalPage>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Términos de Servicio">
      <Section title="1. El servicio">
        <p>Mil Tareas es una plataforma que pone en contacto a alumnos que publican pedidos con tutores que ofrecen ayuda académica. Mil Tareas no es parte del acuerdo entre alumno y tutor.</p>
      </Section>
      <Section title="2. Tu cuenta">
        <p>Debes dar datos verdaderos y mantener segura tu contraseña. Eres responsable de la actividad de tu cuenta. Los tutores son evaluados y activados por nuestro equipo.</p>
      </Section>
      <Section title="3. Pagos">
        <p>El alumno paga por transferencia según las cuentas indicadas en la aplicación y sube el comprobante; el pago se libera al tutor tras la verificación. Los precios se acuerdan entre alumno y tutor dentro del chat.</p>
      </Section>
      <Section title="4. Conducta">
        <p>Está prohibido el acoso, el contenido ofensivo o ilegal, el spam, el fraude, suplantar a otra persona y sacar la conversación o el pago de la plataforma para evitar el servicio. Puedes reportar o bloquear a cualquier usuario desde el chat.</p>
      </Section>
      <Section title="5. Uso académico responsable">
        <p>El material que recibas es de apoyo para tu aprendizaje. Eres responsable de cumplir las normas de tu institución.</p>
      </Section>
      <Section title="6. Suspensión">
        <p>Podemos suspender o cerrar cuentas que incumplan estos términos. Puedes eliminar tu cuenta en cualquier momento desde tu perfil.</p>
      </Section>
      <Section title="7. Responsabilidad">
        <p>Hacemos lo posible por que el servicio esté disponible, pero no garantizamos resultados académicos ni disponibilidad continua. Nuestra responsabilidad se limita al monto pagado por el pedido en disputa.</p>
      </Section>
      <Section title="8. Contacto">
        <Contact />
      </Section>
    </LegalPage>
  );
}
