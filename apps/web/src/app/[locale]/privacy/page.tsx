import type { Metadata } from 'next';

interface PrivacyPageProps {
  params: { locale: string };
}

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage({ params }: PrivacyPageProps) {
  const locale = params?.locale ?? 'es';
  const isSpanish = locale === 'es';

  if (isSpanish) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10 lg:py-12 prose prose-sm sm:prose space-y-4">
        <h1>Política de Privacidad</h1>

        <p>
          Esta Política de Privacidad explica cómo Portfolio X-Ray (&quot;Portafolio Xray&quot;,
          &quot;nosotros&quot; o &quot;nuestro&quot;) recopila, utiliza y protege tus datos
          personales cuando utilizas nuestro servicio. Nuestro objetivo es seguir principios coherentes
          con la normativa de protección de datos de la UE (incluido el RGPD).
        </p>

        <h2>1. Responsable del tratamiento y contacto</h2>
        <p>
          A efectos de esta Política de Privacidad, Portfolio X-Ray es el responsable del tratamiento
          de los datos personales que recopilamos sobre ti cuando utilizas el servicio.
        </p>
        <p>
          Si tienes preguntas o deseas ejercer tus derechos de protección de datos, puedes contactarnos
          en:
        </p>
        <p>
          Correo electrónico: <a href="mailto:xrayportfolio@gmail.com">xrayportfolio@gmail.com</a>
        </p>

        <h2>2. Datos personales que recopilamos</h2>
        <h3>Información de cuenta y perfil</h3>
        <p>
          Cuando te registras y utilizas el servicio, podemos recopilar:
        </p>
        <ul>
          <li>Dirección de correo electrónico.</li>
          <li>Nombre de usuario.</li>
          <li>Nombre completo (si decides proporcionarlo).</li>
          <li>Contraseña (almacenada en forma cifrada, no en texto plano).</li>
          <li>Metadatos básicos sobre tus carteras (como nombres de cartera, descripciones y configuración de visibilidad).</li>
        </ul>

        <h3>Información de uso</h3>
        <p>
          Podemos recopilar información técnica y de uso limitada cuando interactúas con el servicio,
          como:
        </p>
        <ul>
          <li>Datos de registro (por ejemplo, marcas de tiempo, páginas visitadas, información básica del dispositivo y navegador).</li>
          <li>Acciones relacionadas con tus carteras (por ejemplo, crear, editar, compartir o explorar carteras).</li>
        </ul>

        <h3>Datos de x-ray y procesamiento por terceros</h3>
        <p>
          Nuestro servicio te ayuda a enviar información de cartera a un proveedor externo para
          generar un análisis de cartera (&quot;x-ray&quot;). No almacenamos el informe x-ray ni los
          datos de análisis resultantes en nuestros sistemas más allá de lo técnicamente necesario para
          solicitar el informe y mostrarlo en tu navegador.
        </p>
        <p>
          El proveedor de análisis recibe los datos necesarios para realizar el cálculo. El tratamiento
          que dicho proveedor hace de los datos se rige por sus propios términos y política de
          privacidad, que no controlamos.
        </p>

        <h2>3. Fines y bases legales del tratamiento</h2>
        <p>Tratamos tus datos personales para los siguientes fines y bases legales:</p>
        <ul>
          <li>
            <strong>Prestar y operar el servicio</strong>: por ejemplo, para crear tu cuenta,
            autenticarte, gestionar tus carteras y generar solicitudes de x-ray. La base legal es la
            ejecución de un contrato (art. 6.1.b RGPD).
          </li>
          <li>
            <strong>Mantener la seguridad y prevenir abusos</strong>: por ejemplo, prevenir accesos no
            autorizados, detectar actividad sospechosa o hacer cumplir nuestros Términos. La base legal
            es nuestro interés legítimo en proteger el servicio (art. 6.1.f RGPD).
          </li>
          <li>
            <strong>Comunicarnos contigo</strong>: por ejemplo, para enviarte correos transaccionales
            (verificación de cuenta, restablecimiento de contraseña, mensajes importantes sobre el
            servicio). La base legal es la ejecución de un contrato y nuestro interés legítimo en
            mantenerte informado de cambios relevantes.
          </li>
          <li>
            <strong>Responder a tus solicitudes</strong>: por ejemplo, cuando nos contactas a través del
            formulario de contacto o por correo electrónico. La base legal es nuestro interés legítimo
            en responder a las consultas de los usuarios y, cuando proceda, la ejecución de un contrato.
          </li>
        </ul>

        <h2>4. Cómo compartimos tus datos</h2>
        <p>
          No vendemos tus datos personales. Podemos compartirlos con:
        </p>
        <ul>
          <li>
            <strong>Proveedores de servicios</strong> que nos ayudan a operar el servicio (por ejemplo,
            proveedores de alojamiento, servicios de envío de correo electrónico y el proveedor externo
            de análisis x-ray).
          </li>
          <li>
            <strong>Autoridades u otros terceros</strong> cuando la ley, un reglamento o un proceso
            legal lo requiera, o cuando sea necesario para proteger nuestros derechos, propiedad o
            seguridad o los de terceros.
          </li>
        </ul>

        <h2>5. Conservación de datos</h2>
        <p>
          Conservamos los datos de tu cuenta mientras esta permanezca activa y durante un período
          limitado después de que la cierres, en la medida necesaria para cumplir obligaciones legales,
          resolver disputas o hacer valer nuestros acuerdos.
        </p>
        <p>
          Los datos utilizados para solicitar análisis x-ray se tratan generalmente de forma
          transitoria: se envían al proveedor externo y se utilizan para mostrar el resultado, pero no
          los almacenamos con fines analíticos o de elaboración de perfiles a largo plazo.
        </p>

        <h2>6. Seguridad</h2>
        <p>
          Adoptamos medidas técnicas y organizativas razonables para proteger tus datos personales frente
          a accesos no autorizados, pérdidas, usos indebidos o alteraciones. Sin embargo, ningún sistema
          puede ser completamente seguro y no podemos garantizar la seguridad absoluta de los datos.
        </p>

        <h2>7. Tus derechos</h2>
        <p>
          Dependiendo de tu ubicación y de la legislación aplicable (en particular, si estás en la
          Unión Europea o el Espacio Económico Europeo), puedes tener los siguientes derechos sobre tus
          datos personales:
        </p>
        <ul>
          <li>Derecho de acceso: obtener confirmación de si tratamos tus datos y recibir una copia.</li>
          <li>Derecho de rectificación: corregir datos inexactos o incompletos.</li>
          <li>Derecho de supresión: solicitar el borrado de tus datos en determinadas circunstancias.</li>
          <li>Derecho a la limitación del tratamiento: pedir que restrinjamos el uso de tus datos.</li>
          <li>Derecho a la portabilidad: recibir tus datos en un formato estructurado y de uso común.</li>
          <li>Derecho de oposición: oponerte a determinados tratamientos basados en intereses legítimos.</li>
        </ul>
        <p>
          También tienes derecho a presentar una reclamación ante una autoridad de control, en particular
          en el Estado miembro de la UE/EEE donde tengas tu residencia habitual, tu lugar de trabajo o
          donde se haya producido la supuesta infracción.
        </p>

        <h2>8. Menores de edad</h2>
        <p>
          El servicio está dirigido a personas adultas y no a menores. Debes tener al menos 18 años o la
          mayoría de edad en tu jurisdicción para crear una cuenta y utilizar el servicio. No recopilamos
          de forma consciente datos personales de menores.
        </p>

        <h2>9. Transferencias internacionales</h2>
        <p>
          Dependiendo de dónde te encuentres y de dónde estén ubicados nuestros proveedores de servicios,
          tus datos personales pueden transferirse y tratarse en países distintos al tuyo. Cuando la ley
          lo exija, adoptaremos las garantías adecuadas para proteger tus datos en relación con dichas
          transferencias.
        </p>

        <h2>10. Cambios en esta política</h2>
        <p>
          Podemos actualizar esta Política de Privacidad de vez en cuando. Cuando realicemos cambios
          materiales, adoptaremos medidas razonables para informarte, por ejemplo, actualizando la fecha
          de &quot;Última actualización&quot; o mostrando un aviso dentro del servicio.
        </p>
        <p>
          Si sigues utilizando el servicio después de que la política actualizada entre en vigor, se
          entenderá que has leído y entendido los cambios.
        </p>

        <h2>11. Contacto</h2>
        <p>
          Si tienes preguntas sobre esta Política de Privacidad o sobre cómo tratamos tus datos
          personales, puedes contactarnos en:
        </p>
        <p>
          Correo electrónico: <a href="mailto:xrayportfolio@gmail.com">xrayportfolio@gmail.com</a>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10 lg:py-12 prose prose-sm sm:prose space-y-4">
      <h1>Privacy Policy</h1>

      <p>
        This Privacy Policy explains how Portfolio X-Ray (&quot;Portafolio Xray&quot;, &quot;we&quot;,
        &quot;us&quot;, or &quot;our&quot;) collects, uses and protects your personal data when you
        use our service. We aim to follow principles consistent with EU data protection law (including
        the GDPR).
      </p>

      <h2>1. Data Controller and Contact</h2>
      <p>
        For the purposes of this Privacy Policy, Portfolio X-Ray is the data controller for the
        personal data we collect about you when you use the service.
      </p>
      <p>
        If you have any questions or wish to exercise your data protection rights, you can contact us
        at:
      </p>
      <p>
        Email: <a href="mailto:xrayportfolio@gmail.com">xrayportfolio@gmail.com</a>
      </p>

      <h2>2. Personal Data We Collect</h2>
      <h3>Account and Profile Information</h3>
      <p>
        When you register and use the service, we may collect:
      </p>
      <ul>
        <li>Email address.</li>
        <li>Username.</li>
        <li>Full name (if you choose to provide it).</li>
        <li>Password (stored in hashed form, not in plain text).</li>
        <li>Basic metadata about your portfolios (such as portfolio names, descriptions and visibility settings).</li>
      </ul>

      <h3>Usage Information</h3>
      <p>
        We may collect limited technical and usage information when you interact with the service, such
        as:
      </p>
      <ul>
        <li>Log data (e.g. timestamps, pages visited, basic device and browser information).</li>
        <li>Actions related to your portfolios (e.g. creating, editing, sharing or exploring portfolios).</li>
      </ul>

      <h3>X-Ray Data and Third-Party Processing</h3>
      <p>
        Our service helps you send portfolio information to an external third-party provider to
        generate a portfolio &quot;x-ray&quot; analysis. We do not store the resulting x-ray report or
        analysis data on our systems beyond what is technically necessary to request the report and
        display it to you in your browser.
      </p>
      <p>
        The third-party analysis provider receives the necessary data to perform their computation.
        Their handling of data is subject to their own terms and privacy policy, which are not under
        our control.
      </p>

      <h2>3. Purposes and Legal Bases for Processing</h2>
      <p>We process your personal data for the following purposes and legal bases:</p>
      <ul>
        <li>
          <strong>To provide and operate the service</strong> – for example, to create your account,
          authenticate you, manage your portfolios and generate x-ray requests. The legal basis is
          performance of a contract (Article 6(1)(b) GDPR).
        </li>
        <li>
          <strong>To maintain security and prevent abuse</strong> – such as preventing unauthorized
          access, detecting suspicious activity or enforcing our Terms. The legal basis is our
          legitimate interests in securing the service (Article 6(1)(f) GDPR).
        </li>
        <li>
          <strong>To communicate with you</strong> – for example, to send transactional emails (account
          verification, password reset, important service messages). The legal basis is performance of a
          contract and legitimate interests in keeping you informed about important changes.
        </li>
        <li>
          <strong>To respond to your requests</strong> – for example, when you contact us through the
          contact form or email. The legal basis is our legitimate interests in responding to user
          inquiries and, where relevant, performance of a contract.
        </li>
      </ul>

      <h2>4. How We Share Your Data</h2>
      <p>
        We do not sell your personal data. We may share your data with:
      </p>
      <ul>
        <li>
          <strong>Service providers</strong> who help us operate the service (for example, hosting
          providers, email delivery services, and the third-party x-ray analysis provider).
        </li>
        <li>
          <strong>Authorities or third parties</strong> when required by law, regulation or legal
          process, or to protect our rights, property or safety or that of others.
        </li>
      </ul>

      <h2>5. Data Retention</h2>
      <p>
        We keep your account data for as long as your account is active and for a limited period after
        you close your account, to the extent necessary to comply with legal obligations, resolve
        disputes or enforce our agreements.
      </p>
      <p>
        Data used to request x-ray analyses is generally handled in a transient way: it is sent to the
        third-party provider and used to display the result to you, but is not stored by us for
        long-term analytical or profiling purposes.
      </p>

      <h2>6. Security</h2>
      <p>
        We take reasonable technical and organizational measures to protect your personal data against
        unauthorized access, loss, misuse or alteration. However, no system can be entirely secure, and
        we cannot guarantee absolute security of your data.
      </p>

      <h2>7. Your Rights</h2>
      <p>
        Depending on your location and applicable law (in particular, if you are in the European Union
        or European Economic Area), you may have the following rights with respect to your personal
        data:
      </p>
      <ul>
        <li>Right of access – to obtain confirmation as to whether we process your data and receive a copy.</li>
        <li>Right to rectification – to have inaccurate or incomplete data corrected.</li>
        <li>Right to erasure – to request deletion of your data in certain circumstances.</li>
        <li>Right to restriction of processing – to request that we limit how we use your data.</li>
        <li>Right to data portability – to receive your data in a structured, commonly used format.</li>
        <li>Right to object – to object to certain processing based on legitimate interests.</li>
      </ul>
      <p>
        You also have the right to lodge a complaint with a supervisory authority, in particular in the
        EU/EEA member state of your habitual residence, place of work or place of the alleged
        infringement.
      </p>

      <h2>8. Children and Minors</h2>
      <p>
        The service is intended for adults and is not directed to children. You must be at least 18
        years old or the age of majority in your jurisdiction to create an account and use the service.
        We do not knowingly collect personal data from children.
      </p>

      <h2>9. International Transfers</h2>
      <p>
        Depending on where you are located and where our service providers are based, your personal
        data may be transferred to and processed in countries outside of your own. Where required by
        law, we will ensure that appropriate safeguards are in place to protect your data in connection
        with such transfers.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we make material changes, we will
        take reasonable steps to inform you, for example by updating the &quot;Last updated&quot; date
        or providing a notice within the service.
      </p>
      <p>
        Your continued use of the service after the updated policy becomes effective will mean that you
        have read and understood the changes.
      </p>

      <h2>11. Contact</h2>
      <p>
        If you have questions about this Privacy Policy or how we handle your personal data, you can
        contact us at:
      </p>
      <p>
        Email: <a href="mailto:xrayportfolio@gmail.com">xrayportfolio@gmail.com</a>
      </p>
    </div>
  );
}

