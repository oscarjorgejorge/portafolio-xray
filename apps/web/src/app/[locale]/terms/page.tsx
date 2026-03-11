import type { Metadata } from 'next';

interface TermsPageProps {
  params: { locale: string };
}

export const metadata: Metadata = {
  title: 'Terms & Conditions',
};

export default function TermsPage({ params }: TermsPageProps) {
  const locale = params?.locale ?? 'es';
  const isSpanish = locale === 'es';

  if (isSpanish) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10 lg:py-12 prose prose-sm sm:prose space-y-4">
        <h1>Términos y Condiciones</h1>

        <p>
          Estos Términos y Condiciones (&quot;Términos&quot;) regulan el uso que haces de Portfolio X-Ray
          (&quot;Portafolio Xray&quot;, &quot;nosotros&quot; o &quot;nuestro&quot;) y de los servicios
          relacionados que ponemos a tu disposición. Al crear una cuenta o utilizar el servicio, aceptas
          quedar vinculado por estos Términos. Si no estás de acuerdo, no debes usar el servicio.
        </p>

        <h2>1. Descripción del servicio y procesamiento por terceros</h2>
        <p>
          Portfolio X-Ray es un proyecto que te ayuda a generar análisis de cartera (&quot;x-ray&quot;)
          utilizando un proveedor de servicios de terceros. Nuestro papel se limita a ayudarte a
          construir y compartir carteras y a enviar la información necesaria al servicio de análisis
          externo para que pueda generar un informe para ti.
        </p>
        <p>
          El cálculo, análisis y generación del informe x-ray los realiza un proveedor de servicios
          independiente. No operamos, controlamos ni validamos a dicho tercero. Sus propios términos,
          condiciones y políticas de privacidad pueden aplicarse por separado a tu uso de sus servicios.
        </p>

        <h2>2. Sin asesoramiento médico, de inversión ni profesional</h2>
        <p>
          El servicio y cualquier informe o dato que recibas a través de él se proporcionan únicamente
          con fines informativos e ilustrativos. No constituyen asesoramiento médico, de inversión,
          legal, fiscal ni de ningún otro tipo de asesoramiento profesional.
        </p>
        <p>
          No debes basarte en el servicio ni en los informes generados para tomar decisiones médicas o
          financieras. Siempre debes solicitar el consejo de profesionales cualificados (como médicos
          colegiados, asesores financieros u otros expertos) antes de tomar cualquier decisión basada en
          los datos mostrados en el servicio.
        </p>

        <h3>Datos de activos y posibles errores</h3>
        <p>
          La información sobre activos puede resolverse de forma automática a partir de identificadores
          (como ISIN, tickers o IDs de Morningstar) utilizando fuentes externas. Algunos activos pueden
          resolverse de forma incorrecta, parcial o no resolverse en absoluto. Los datos pueden estar
          incompletos, desactualizados o contener errores.
        </p>
        <p>
          Tú eres el único responsable de comprobar que los datos de activos, la composición de la
          cartera y el análisis generado son correctos y adecuados para tu caso de uso. No somos
          responsables de las consecuencias derivadas de datos incorrectos o incompletos, incluidos
          activos resueltos de forma errónea o no resueltos.
        </p>

        <h2>3. Elegibilidad y responsabilidades del usuario</h2>
        <p>
          Solo puedes utilizar el servicio si tienes al menos 18 años o la mayoría de edad en tu
          jurisdicción (la que sea mayor) y tienes capacidad legal para aceptar estos Términos.
        </p>
        <p>Eres responsable de:</p>
        <ul>
          <li>Mantener tus credenciales de cuenta seguras y confidenciales.</li>
          <li>Proporcionar información veraz y actualizada al registrarte y usar el servicio.</li>
          <li>Cumplir las leyes y normativas aplicables al utilizar el servicio.</li>
          <li>Asegurarte de que los datos de carteras o activos que introduzcas no vulneran derechos de terceros.</li>
        </ul>

        <h2>4. Registro y uso de la cuenta</h2>
        <p>
          Para utilizar determinadas funciones debes crear una cuenta y proporcionar información básica
          (como correo electrónico, nombre de usuario, nombre y contraseña). Aceptas mantener dicha
          información exacta y actualizada.
        </p>
        <p>
          Podemos suspender o cancelar tu acceso si creemos razonablemente que has infringido estos
          Términos, has intentado hacer un uso indebido del servicio o has llevado a cabo actividades
          fraudulentas o abusivas.
        </p>

        <h2>5. Servicios y enlaces de terceros</h2>
        <p>
          El servicio depende de servicios de terceros, incluido el proveedor de análisis x-ray y
          cualquier fuente de datos externa utilizada para resolver o enriquecer activos. No respaldamos,
          controlamos ni asumimos responsabilidad por el contenido, exactitud, disponibilidad o políticas
          de dichos servicios de terceros.
        </p>
        <p>
          Tu uso de servicios de terceros se realiza bajo tu propio riesgo y puede estar sujeto a
          términos y políticas de privacidad adicionales que no controlamos.
        </p>

        <h2>6. Propiedad intelectual</h2>
        <p>
          El servicio, incluida su interfaz, diseño, código y demás contenidos (excluyendo tus propios
          datos de cartera y cualquier contenido de terceros) es propiedad nuestra o de nuestros
          licenciantes y está protegido por las leyes de propiedad intelectual aplicables.
        </p>
        <p>
          Se te concede una licencia limitada, no exclusiva, intransferible y revocable para acceder y
          utilizar el servicio con fines personales y no comerciales, de acuerdo con estos Términos. No
          puedes copiar, modificar, distribuir, vender, realizar ingeniería inversa ni crear obras
          derivadas del servicio salvo en la medida permitida por la ley.
        </p>

        <h2>7. Exclusión de garantías</h2>
        <p>
          El servicio se proporciona &quot;tal cual&quot; y &quot;según disponibilidad&quot;, sin
          garantías de ningún tipo, ya sean expresas, implícitas o legales. En particular, no garantizamos
          que:
        </p>
        <ul>
          <li>El servicio sea ininterrumpido, seguro o esté libre de errores.</li>
          <li>Los datos, análisis o informes sean exactos, completos, actualizados o adecuados para cualquier fin.</li>
          <li>Los servicios de terceros de los que dependemos estén disponibles, sean correctos o seguros.</li>
        </ul>
        <p>
          En la máxima medida permitida por la ley, rechazamos todas las garantías implícitas, incluidas
          las de comerciabilidad, idoneidad para un fin determinado y no infracción.
        </p>

        <h2>8. Limitación de responsabilidad</h2>
        <p>
          En la máxima medida permitida por la legislación aplicable, no seremos responsables de ningún
          daño indirecto, incidental, consecuencial, especial, punitivo o ejemplar, ni de pérdida de
          beneficios, ingresos, datos o fondo de comercio derivados de tu uso del servicio o relacionados
          con él, incluso si se nos hubiera advertido de la posibilidad de dichos daños.
        </p>
        <p>
          Nuestra responsabilidad total agregada frente a ti por cualquier reclamación relacionada con el
          servicio o estos Términos se limitará al mayor de: (a) el importe que hayas pagado (si lo
          hubiera) por acceder al servicio durante los 12 meses anteriores a la reclamación, o (b) 50 EUR.
        </p>

        <h2>9. Indemnización</h2>
        <p>
          Aceptas indemnizar y mantener indemne a Portfolio X-Ray, sus operadores y colaboradores frente
          a cualquier reclamación, responsabilidad, daño, pérdida y gasto (incluidos honorarios legales
          razonables) derivados de o relacionados con tu uso del servicio, el incumplimiento de estos
          Términos o la vulneración de derechos de terceros.
        </p>

        <h2>10. Protección de datos y privacidad</h2>
        <p>
          El tratamiento que hacemos de tus datos personales se describe con más detalle en nuestra
          Política de Privacidad. Al utilizar el servicio, reconoces que tus datos personales se tratarán
          de acuerdo con dicha política.
        </p>

        <h2>11. Cambios en el servicio y en estos Términos</h2>
        <p>
          Podemos actualizar o modificar el servicio periódicamente, incluyendo añadir, cambiar o eliminar
          funciones. También podemos actualizar estos Términos. Cuando realicemos cambios materiales,
          adoptaremos medidas razonables para informarte, por ejemplo, actualizando la fecha de &quot;Última
          actualización&quot; o mostrando un aviso en el servicio.
        </p>
        <p>
          Si continúas utilizando el servicio después de que los cambios entren en vigor, se entenderá que
          aceptas los Términos revisados. Si no estás de acuerdo, debes dejar de usar el servicio.
        </p>

        <h2>12. Ley aplicable y disputas</h2>
        <p>
          Estos Términos están pensados para interpretarse de forma coherente con la legislación
          aplicable en la Unión Europea. Dependiendo de tu país de residencia, las leyes imperativas de
          protección al consumidor o de protección de datos pueden otorgarte derechos adicionales que no
          pueden limitarse por contrato.
        </p>

        <h2>13. Contacto</h2>
        <p>
          Si tienes preguntas sobre estos Términos, puedes contactarnos en:
        </p>
        <p>
          Correo electrónico: <a href="mailto:xrayportfolio@gmail.com">xrayportfolio@gmail.com</a>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10 lg:py-12 prose prose-sm sm:prose space-y-4">
      <h1>Terms &amp; Conditions</h1>

      <p>
        These Terms &amp; Conditions (&quot;Terms&quot;) govern your use of Portfolio X-Ray
        (&quot;Portafolio Xray&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) and any related
        services we provide. By creating an account or using the service, you agree to be bound by
        these Terms. If you do not agree, you must not use the service.
      </p>

      <h2>1. Service Description and Third-Party Processing</h2>
      <p>
        Portfolio X-Ray is a project that helps you generate portfolio &quot;x-ray&quot; analyses using
        a third-party service provider. Our role is limited to helping you build and share portfolios
        and sending the necessary information to the external analysis service so that it can generate
        a report for you.
      </p>
      <p>
        The actual x-ray computation, analysis and report generation are performed by an independent
        third-party service provider. We do not operate, control, or validate that third party. Their
        terms, conditions, and privacy practices may apply separately to your use of their services.
      </p>

      <h2>2. No Medical, Investment, or Professional Advice</h2>
      <p>
        The service and any reports or data you receive through it are provided solely for
        informational and illustrative purposes. They do not constitute medical, investment, legal, tax
        or any other form of professional advice.
      </p>
      <p>
        You must not rely on the service or any generated reports to make medical or financial
        decisions. Always seek advice from qualified professionals (such as licensed doctors,
        financial advisers or other experts) before taking any decision based on data shown in the
        service.
      </p>

      <h3>Asset Data and Possible Errors</h3>
      <p>
        Asset information may be automatically resolved from identifiers (such as ISINs, tickers or
        Morningstar IDs) using external sources. Some assets may be resolved incorrectly, partially, or
        not at all. Data can be incomplete, outdated or inaccurate.
      </p>
      <p>
        You are solely responsible for checking that any asset data, portfolio composition and
        generated analysis are correct and appropriate for your use case. We are not responsible for
        any consequences arising from incorrect or incomplete data, including wrongly resolved or
        unresolved assets.
      </p>

      <h2>3. Eligibility and User Responsibilities</h2>
      <p>
        You may use the service only if you are at least 18 years old or the age of majority in your
        jurisdiction, whichever is higher, and you have the legal capacity to enter into these Terms.
      </p>
      <p>
        You are responsible for:
      </p>
      <ul>
        <li>Keeping your account credentials secure and confidential.</li>
        <li>Providing accurate and up-to-date information when registering and using the service.</li>
        <li>Complying with applicable laws and regulations when using the service.</li>
        <li>Ensuring that any portfolio or asset data you enter does not infringe the rights of third parties.</li>
      </ul>

      <h2>4. Account Registration and Usage</h2>
      <p>
        To use certain features, you must create an account and provide basic account information
        (such as email, username, name and password). You agree to keep this information accurate and
        up to date.
      </p>
      <p>
        We may suspend or terminate your access if we reasonably believe that you have violated these
        Terms, attempted to misuse the service, or engaged in fraudulent or abusive activity.
      </p>

      <h2>5. Third-Party Services and Links</h2>
      <p>
        The service depends on third-party services, including the x-ray analysis provider and any
        external data sources used to resolve or enrich assets. We do not endorse, control or assume
        responsibility for the content, accuracy, availability or policies of any third-party services.
      </p>
      <p>
        Your use of third-party services is at your own risk and may be subject to additional terms
        and privacy policies that are not under our control.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        The service, including its user interface, design, code and other content (excluding your own
        portfolio data and any third-party content) is owned by us or our licensors and is protected by
        applicable intellectual property laws.
      </p>
      <p>
        You are granted a limited, non-exclusive, non-transferable and revocable license to access and
        use the service for personal, non-commercial purposes in accordance with these Terms. You must
        not copy, modify, distribute, sell, reverse-engineer or create derivative works from the
        service except as expressly allowed by law.
      </p>

      <h2>7. Disclaimer of Warranties</h2>
      <p>
        The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without
        warranties of any kind, whether express, implied or statutory. In particular, we do not
        guarantee that:
      </p>
      <ul>
        <li>The service will be uninterrupted, secure or error-free.</li>
        <li>Any data, analysis or reports will be accurate, complete, up to date or suitable for any purpose.</li>
        <li>Third-party services on which we depend will be available, correct or secure.</li>
      </ul>
      <p>
        To the maximum extent permitted by law, we disclaim all implied warranties, including any
        implied warranties of merchantability, fitness for a particular purpose and non-infringement.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, we are not liable for any indirect,
        incidental, consequential, special, punitive or exemplary damages, or for any loss of profits,
        revenues, data or goodwill, arising from or related to your use of the service, even if we have
        been advised of the possibility of such damages.
      </p>
      <p>
        Our total aggregate liability to you for any claims arising out of or relating to the service
        or these Terms will be limited to the greater of: (a) the amount you have paid (if any) for
        access to the service during the 12 months immediately preceding the claim, or (b) EUR 50.
      </p>

      <h2>9. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless Portfolio X-Ray, its operators and contributors from
        and against any claims, liabilities, damages, losses and expenses (including reasonable legal
        fees) arising out of or in any way connected with your use of the service, your violation of
        these Terms, or your infringement of any third-party rights.
      </p>

      <h2>10. Data Protection and Privacy</h2>
      <p>
        Our handling of personal data is described in more detail in our Privacy Policy. By using the
        service, you acknowledge that your personal data will be processed in accordance with that
        policy.
      </p>

      <h2>11. Changes to the Service and to These Terms</h2>
      <p>
        We may update or modify the service from time to time, including by adding, changing or
        removing features. We may also update these Terms. When we make material changes, we will take
        reasonable steps to notify you, such as updating the &quot;Last updated&quot; date or
        providing a notice in the service.
      </p>
      <p>
        By continuing to use the service after changes take effect, you agree to the revised Terms. If
        you do not agree, you must stop using the service.
      </p>

      <h2>12. Governing Law and Disputes</h2>
      <p>
        These Terms are intended to be interpreted consistently with applicable laws in the European
        Union. Depending on your country of residence, mandatory consumer protection or data
        protection laws may grant you additional rights that cannot be limited by contract.
      </p>

      <h2>13. Contact</h2>
      <p>
        If you have any questions about these Terms, you can contact us at:
      </p>
      <p>
        Email: <a href="mailto:xrayportfolio@gmail.com">xrayportfolio@gmail.com</a>
      </p>
    </div>
  );
}

