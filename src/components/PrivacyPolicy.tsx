import type { ReactNode } from "react";
import type { Lang } from "@/lib/i18n";

/** Date shown at the top of the policy (DD.MM.YYYY, like the rest of the app). */
export const PRIVACY_UPDATED = "18.11.2026";

function H2({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="mt-12 scroll-mt-24 text-2xl font-semibold text-foreground">{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mt-3">{children}</p>;
}
function UL({ children }: { children: ReactNode }) {
  return <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-primary">{children}</ul>;
}
function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}
function Basis({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm"><em className="not-italic font-semibold text-foreground">{children}</em></p>;
}
function Ext({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">{children}</a>;
}
function Code({ children }: { children: ReactNode }) {
  return <code className="whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</code>;
}

function Contact({ email, missing }: { email: string | null; missing: string }) {
  return email
    ? <a href={`mailto:${email}`} className="text-primary underline-offset-4 hover:underline">{email}</a>
    : <span className="italic text-destructive">{missing}</span>;
}

function Controller({ email, missing, emailLabel, country }: { email: string | null; missing: string; emailLabel: string; country: string }) {
  return (
    <address className="mt-3 border-l-4 border-primary pl-4 not-italic text-foreground">
      Amr Alkhatib<br />74072 Heilbronn, {country}<br />{emailLabel}: <Contact email={email} missing={missing} />
    </address>
  );
}

function StorageTable({ head, rows }: { head: string[]; rows: [ReactNode, string, string, string][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-foreground">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(([name, type, purpose, kept], i) => (
            <tr key={i} className="border-t align-top">
              <td className="px-4 py-3">{name}</td><td className="px-4 py-3">{type}</td><td className="px-4 py-3">{purpose}</td><td className="px-4 py-3">{kept}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LFDI = "https://www.baden-wuerttemberg.datenschutz.de";

export function PrivacyPolicy({ lang, email }: { lang: Lang; email: string | null }) {
  return lang === "de" ? <PolicyDE email={email} /> : <PolicyEN email={email} />;
}

function Summary({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="glass mt-8 rounded-3xl p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-primary">{children}</ul>
    </aside>
  );
}

function PolicyEN({ email }: { email: string | null }) {
  const missing = "the contact address (not configured yet)";
  return (
    <>
      <Summary title="The short version">
        <li>TruckOps is a demo of a booking and fleet-planning system for a food-truck caterer, built as a student project and run by Amr Alkhatib.</li>
        <li>There is no analytics, advertising or tracking. Fonts and stylesheets are served from our own domain.</li>
        <li>If you sign up and book, we store your account and the event and company details you enter, so we can calculate quotes and plan trucks.</li>
        <li>The address search and the map come from OpenStreetMap. Your browser contacts their servers directly when you use them.</li>
        <li>Write to <Contact email={email} missing={missing} /> for a copy of your data or to have it deleted.</li>
      </Summary>

      <H2 id="controller">1. Who is responsible</H2>
      <P>The controller under the EU General Data Protection Regulation (GDPR) is:</P>
      <Controller email={email} missing={missing} emailLabel="Email" country="Germany" />
      <P>TruckOps was built for a case that a catering company brought to the TUM Business Game. “Rolling Feast” is the name that business goes by in the demo. This site is a demonstration operated by Amr Alkhatib: bookings made here are not passed on to a catering company, and no trucks will be sent.</P>

      <H2 id="hosting">2. Hosting and visiting the site</H2>
      <P>TruckOps is hosted by <B>Lovable</B> (Lovable Labs AB, Stockholm, Sweden). When you open a page, Lovable's servers process your IP address, the time, the page you requested and technical details about your browser, in order to deliver the page and protect the service against attacks. Lovable's built-in visitor analytics is switched off for this site.</P>
      <Basis>Legal basis: our legitimate interest in a secure, working website (Art. 6(1)(f) GDPR).</Basis>

      <H2 id="cookies">3. Cookies and browser storage</H2>
      <StorageTable
        head={["Name", "Type", "Purpose", "Kept for"]}
        rows={[
          [<Code key="a">__dpl</Code>, "Cookie, set by the hosting", "Makes sure every part of a page comes from the same version of the app.", "24 hours"],
          [<Code key="b">sb-…-auth-token</Code>, "Local storage", "Keeps you signed in.", "Until you sign out"],
          [<Code key="c">truckops-lang</Code>, "Local storage", "Remembers the language you picked.", "Until you delete it"],
          [<Code key="d">truckops-theme</Code>, "Local storage", "Remembers light or dark mode.", "Until you delete it"],
        ]}
      />
      <P>All of these are strictly necessary for a service you asked for (§ 25(2) No. 2 TDDDG), so we don't ask for consent and there is no cookie banner. None of them are used for tracking.</P>

      <H2 id="account">4. Your account</H2>
      <P>To create a planner account you give us your <B>full name</B>, your <B>work email</B> and a <B>password</B>. On your profile page you can add a phone number, your company name and a billing address. Sign-in, email confirmation and password resets run on Lovable Cloud, which uses <B>Supabase</B> (Supabase Inc., USA). Your password is only stored as a hash. Sign-in events, including the IP address, are logged for security. Every account also has a role (planner, staff or admin) that decides what you can see.</P>
      <Basis>Legal basis: providing the account you asked for (Art. 6(1)(b) GDPR).</Basis>

      <H2 id="bookings">5. Quotes and bookings</H2>
      <P>To quote and plan an event, the booking wizard asks for: the package, date and times; the venue's name and address, which we turn into map coordinates; details about the site (power, height clearance, space); the number of guests and their dietary needs; add-ons; your company name, billing address and purchase-order number; and a contact person with a mobile number. For larger orders it also asks for the name and email of a second person at your company who approves the order.</P>
      <P>We store this together with the calculated quote, the trucks assigned, the booking status and a change history that records who changed what and when. Venues you save as presets are stored too. Staff and admins in the back office can see all bookings, because they plan the fleet across all of them. Quote PDFs are created in your browser and are not stored by us.</P>
      <Basis>Legal basis: preparing and carrying out the booking (Art. 6(1)(b) GDPR).</Basis>

      <H2 id="approvers">6. Approvers and booking links</H2>
      <P><B>Approvers.</B> If you name an approver, you get a link to send them yourself; TruckOps does not email them. Through the link they can see the quote and accept or reject it, with a reason if they like. We store their decision, the reason and their email address in the booking's history. Please let your approver know that you are giving us their name and email address.</P>
      <Basis>Legal basis: the interest of your company and of the caterer in having larger orders approved internally (Art. 6(1)(f) GDPR).</Basis>
      <P><B>Booking links.</B> A planner can create a link that lets colleagues book without an account. For the link we store a label, the company name, the billing address and, optionally, a contact email. Bookings made through the link belong to the person who created it, and the details entered are stored as described in section 5.</P>

      <H2 id="maps">7. Maps, address search and routes</H2>
      <P>Some features need outside services. Your browser contacts them directly, so they receive your IP address:</P>
      <UL>
        <li><B>Address search:</B> what you type into the venue address field is sent to <Ext href="https://osmfoundation.org/wiki/Privacy_Policy">Nominatim</Ext>, run by the OpenStreetMap Foundation (United Kingdom).</li>
        <li><B>Maps:</B> map images are loaded from tile.openstreetmap.org (OpenStreetMap Foundation), which learns which map area you are looking at.</li>
        <li><B>Road distance:</B> the coordinates of the depot and the venue are sent to the routing server router.project-osrm.org, run by <Ext href="https://www.fossgis.de/datenschutzerklaerung/">FOSSGIS e.V.</Ext> (Germany). Our server sends the same coordinates again when it checks your quote.</li>
      </UL>
      <P>Our server also uses these services, which receive no data about you:</P>
      <UL>
        <li><B>OpenRouteService</B> (HeiGIT gGmbH, Heidelberg, Germany), when the route check for tall trucks is enabled. It only receives the coordinates of the depot and the venue.</li>
        <li><B>date.nager.at</B>, for the list of public holidays.</li>
      </UL>
      <Basis>Legal basis: address search, map and road distance are needed to quote your event (Art. 6(1)(b) and (f) GDPR). The United Kingdom is covered by an EU adequacy decision.</Basis>

      <H2 id="processors">8. Who processes data for us</H2>
      <UL>
        <li><B>Lovable Labs AB</B> (Sweden): hosting, database, sign-in and server functions (Lovable Cloud).</li>
        <li><B>Supabase Inc.</B> (USA), as Lovable's sub-processor: runs the database and sign-in behind Lovable Cloud.</li>
      </UL>
      <P>Both work for us under a data processing agreement (Art. 28 GDPR). Where data is processed outside the EU/EEA, it is protected by the EU standard contractual clauses or the EU–US Data Privacy Framework. We don't sell data or use it for advertising.</P>

      <H2 id="retention">9. How long we keep data</H2>
      <UL>
        <li><B>Account, profile, saved venues, bookings and their history:</B> until you ask us to delete your account; we then delete them within 30 days. Because this is a demo, no invoices are issued and no tax retention period applies. We may also reset the demo data at any time.</li>
        <li><B>Approver and booking-link details:</B> as long as the booking or link they belong to.</li>
        <li><B>Hosting logs:</B> deleted automatically by Lovable after a short period.</li>
        <li><B>Cookies and browser storage:</B> see section 3.</li>
      </UL>

      <H2 id="rights">10. Your rights</H2>
      <P>You have the right to:</P>
      <UL>
        <li>get a copy of the data we hold about you (Art. 15 GDPR),</li>
        <li>have wrong data corrected (Art. 16); much of it you can change yourself under “Profile &amp; places”,</li>
        <li>have your data deleted (Art. 17) or its use restricted (Art. 18),</li>
        <li>receive the data you gave us in a machine-readable format (Art. 20),</li>
        <li>object to processing based on legitimate interests (Art. 21).</li>
      </UL>
      <P>To use any of these rights, write to <Contact email={email} missing={missing} />, ideally from the email address on your account. You will hear back within one month.</P>
      <P>You can also complain to a data protection authority, for example the one responsible for us: <Ext href={LFDI}>Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg</Ext>, Lautenschlagerstraße 20, 70173 Stuttgart.</P>

      <H2 id="other">11. Other things you should know</H2>
      <P>You can look around without giving us any personal data; to book, the fields marked as required are needed. Quotes and truck plans are calculated automatically from the event details (date, place, guests, diets and times). The calculation looks at the event, not at you as a person.</P>
      <P>If TruckOps starts processing data in a new way, we will update this page first and change the date at the top.</P>
    </>
  );
}

function PolicyDE({ email }: { email: string | null }) {
  const missing = "die Kontaktadresse (noch nicht eingerichtet)";
  return (
    <>
      <Summary title="Kurz gesagt">
        <li>TruckOps ist die Demo eines Buchungs- und Flottenplanungssystems für einen Food-Truck-Caterer. Sie ist als Studienprojekt entstanden und wird von Amr Alkhatib betrieben.</li>
        <li>Es gibt keine Analyse-, Werbe- oder Tracking-Dienste. Schriften und Stylesheets kommen von unserer eigenen Domain.</li>
        <li>Wenn Sie sich registrieren und buchen, speichern wir Ihr Konto und die Event- und Firmenangaben, die Sie eingeben, um Angebote zu berechnen und Trucks einzuplanen.</li>
        <li>Adresssuche und Karte stammen von OpenStreetMap. Ihr Browser verbindet sich dafür direkt mit deren Servern.</li>
        <li>Für eine Kopie Ihrer Daten oder deren Löschung schreiben Sie an <Contact email={email} missing={missing} />.</li>
      </Summary>

      <H2 id="controller">1. Verantwortlicher</H2>
      <P>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</P>
      <Controller email={email} missing={missing} emailLabel="E-Mail" country="Deutschland" />
      <P>TruckOps ist für eine Aufgabenstellung entstanden, die ein Catering-Unternehmen beim TUM Business Game eingebracht hat. „Rolling Feast“ ist der Name, unter dem dieses Unternehmen in der Demo auftritt. Diese Website ist eine Demonstration und wird von Amr Alkhatib betrieben: Hier eingegebene Buchungen werden nicht an ein Catering-Unternehmen weitergegeben, und es werden keine Trucks geschickt.</P>

      <H2 id="hosting">2. Hosting und Aufruf der Website</H2>
      <P>TruckOps wird von <B>Lovable</B> (Lovable Labs AB, Stockholm, Schweden) gehostet. Beim Aufruf einer Seite verarbeiten die Server von Lovable Ihre IP-Adresse, den Zeitpunkt, die aufgerufene Seite und technische Angaben zu Ihrem Browser, um die Seite auszuliefern und den Dienst vor Angriffen zu schützen. Die integrierte Besucherstatistik von Lovable ist für diese Website abgeschaltet.</P>
      <Basis>Rechtsgrundlage: unser berechtigtes Interesse an einer sicheren, funktionierenden Website (Art. 6 Abs. 1 lit. f DSGVO).</Basis>

      <H2 id="cookies">3. Cookies und Speicher im Browser</H2>
      <StorageTable
        head={["Name", "Art", "Zweck", "Speicherdauer"]}
        rows={[
          [<Code key="a">__dpl</Code>, "Cookie, vom Hosting gesetzt", "Sorgt dafür, dass alle Teile einer Seite aus derselben Version der App geladen werden.", "24 Stunden"],
          [<Code key="b">sb-…-auth-token</Code>, "Local Storage", "Hält Sie angemeldet.", "Bis zur Abmeldung"],
          [<Code key="c">truckops-lang</Code>, "Local Storage", "Merkt sich die gewählte Sprache.", "Bis Sie ihn löschen"],
          [<Code key="d">truckops-theme</Code>, "Local Storage", "Merkt sich den hellen oder dunklen Modus.", "Bis Sie ihn löschen"],
        ]}
      />
      <P>Alle Einträge sind für einen von Ihnen gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Deshalb fragen wir nicht nach einer Einwilligung, und es gibt keinen Cookie-Banner. Zum Tracking wird keiner davon verwendet.</P>

      <H2 id="account">4. Ihr Konto</H2>
      <P>Für ein Planer-Konto geben Sie Ihren <B>vollständigen Namen</B>, Ihre <B>geschäftliche E-Mail-Adresse</B> und ein <B>Passwort</B> an. Auf Ihrer Profilseite können Sie eine Telefonnummer, den Firmennamen und eine Rechnungsadresse ergänzen. Anmeldung, E-Mail-Bestätigung und Zurücksetzen des Passworts laufen über Lovable Cloud, das dafür <B>Supabase</B> (Supabase Inc., USA) nutzt. Ihr Passwort wird nur als Hash gespeichert. Anmeldevorgänge werden einschließlich IP-Adresse zur Sicherheit protokolliert. Jedes Konto hat außerdem eine Rolle (Planer, Mitarbeiter oder Admin), die festlegt, was Sie sehen.</P>
      <Basis>Rechtsgrundlage: Bereitstellung des von Ihnen gewünschten Kontos (Art. 6 Abs. 1 lit. b DSGVO).</Basis>

      <H2 id="bookings">5. Angebote und Buchungen</H2>
      <P>Für Angebot und Planung fragt der Buchungsassistent: Paket, Datum und Uhrzeiten; Name und Adresse des Veranstaltungsorts, die wir in Kartenkoordinaten umrechnen; Angaben zum Standort (Strom, Durchfahrtshöhe, Fläche); Gästezahl und Ernährungswünsche; Extras; Firmenname, Rechnungsadresse und Bestellnummer (PO); sowie eine Kontaktperson mit Mobilnummer. Bei größeren Aufträgen zusätzlich Name und E-Mail-Adresse einer zweiten Person in Ihrem Unternehmen, die den Auftrag freigibt.</P>
      <P>Wir speichern diese Angaben zusammen mit dem berechneten Angebot, den eingeplanten Trucks, dem Buchungsstatus und einem Änderungsverlauf, der festhält, wer wann was geändert hat. Orte, die Sie als Vorlage speichern, werden ebenfalls gespeichert. Mitarbeiter und Admins im Backoffice sehen alle Buchungen, weil sie die Flotte über alle Buchungen hinweg planen. Angebots-PDFs entstehen in Ihrem Browser und werden von uns nicht gespeichert.</P>
      <Basis>Rechtsgrundlage: Vorbereitung und Durchführung der Buchung (Art. 6 Abs. 1 lit. b DSGVO).</Basis>

      <H2 id="approvers">6. Freigebende Personen und Buchungslinks</H2>
      <P><B>Freigabe.</B> Wenn Sie eine freigebende Person angeben, erhalten Sie einen Link, den Sie selbst an sie weiterleiten; TruckOps schickt ihr keine E-Mail. Über den Link sieht sie das Angebot und kann es annehmen oder ablehnen, auf Wunsch mit Begründung. Wir speichern die Entscheidung, die Begründung und ihre E-Mail-Adresse im Verlauf der Buchung. Bitte informieren Sie die freigebende Person darüber, dass Sie uns ihren Namen und ihre E-Mail-Adresse mitteilen.</P>
      <Basis>Rechtsgrundlage: das Interesse Ihres Unternehmens und des Caterers, größere Aufträge intern freigeben zu lassen (Art. 6 Abs. 1 lit. f DSGVO).</Basis>
      <P><B>Buchungslinks.</B> Planer können einen Link anlegen, mit dem Kolleginnen und Kollegen ohne eigenes Konto buchen können. Zum Link speichern wir eine Bezeichnung, den Firmennamen, die Rechnungsadresse und optional eine Kontakt-E-Mail. Über den Link erstellte Buchungen gehören der Person, die ihn angelegt hat; die dabei eingegebenen Angaben speichern wir wie in Abschnitt 5 beschrieben.</P>

      <H2 id="maps">7. Karten, Adresssuche und Routen</H2>
      <P>Einige Funktionen brauchen externe Dienste. Ihr Browser verbindet sich direkt mit ihnen, daher erhalten sie Ihre IP-Adresse:</P>
      <UL>
        <li><B>Adresssuche:</B> Was Sie in das Adressfeld des Veranstaltungsorts tippen, wird an <Ext href="https://osmfoundation.org/wiki/Privacy_Policy">Nominatim</Ext> der OpenStreetMap Foundation (Vereinigtes Königreich) gesendet.</li>
        <li><B>Karten:</B> Kartenbilder werden von tile.openstreetmap.org (OpenStreetMap Foundation) geladen, die dadurch erfährt, welchen Kartenausschnitt Sie ansehen.</li>
        <li><B>Straßenentfernung:</B> Die Koordinaten von Depot und Veranstaltungsort werden an den Routing-Server router.project-osrm.org gesendet, den <Ext href="https://www.fossgis.de/datenschutzerklaerung/">FOSSGIS e.V.</Ext> (Deutschland) betreibt. Unser Server sendet dieselben Koordinaten noch einmal, wenn er Ihr Angebot prüft.</li>
      </UL>
      <P>Unser Server nutzt außerdem diese Dienste, die keine Daten über Sie erhalten:</P>
      <UL>
        <li><B>OpenRouteService</B> (HeiGIT gGmbH, Heidelberg), sofern die Routenprüfung für hohe Fahrzeuge aktiviert ist. Übermittelt werden nur die Koordinaten von Depot und Veranstaltungsort.</li>
        <li><B>date.nager.at</B> für die Liste der Feiertage.</li>
      </UL>
      <Basis>Rechtsgrundlage: Adresssuche, Karte und Straßenentfernung werden für Ihr Angebot gebraucht (Art. 6 Abs. 1 lit. b und f DSGVO). Für das Vereinigte Königreich besteht ein Angemessenheitsbeschluss der EU-Kommission.</Basis>

      <H2 id="processors">8. Auftragsverarbeiter</H2>
      <UL>
        <li><B>Lovable Labs AB</B> (Schweden): Hosting, Datenbank, Anmeldung und Serverfunktionen (Lovable Cloud).</li>
        <li><B>Supabase Inc.</B> (USA) als Unterauftragsverarbeiter von Lovable: betreibt Datenbank und Anmeldung hinter Lovable Cloud.</li>
      </UL>
      <P>Beide arbeiten auf Grundlage eines Vertrags zur Auftragsverarbeitung (Art. 28 DSGVO) für uns. Soweit Daten außerhalb der EU bzw. des EWR verarbeitet werden, sind sie durch die EU-Standardvertragsklauseln oder das EU-US Data Privacy Framework geschützt. Wir verkaufen keine Daten und nutzen sie nicht für Werbung.</P>

      <H2 id="retention">9. Speicherdauer</H2>
      <UL>
        <li><B>Konto, Profil, gespeicherte Orte, Buchungen und deren Verlauf:</B> bis Sie uns bitten, Ihr Konto zu löschen; wir löschen dann innerhalb von 30 Tagen. Da dies eine Demo ist, werden keine Rechnungen gestellt, und es gelten keine steuerlichen Aufbewahrungsfristen. Wir können die Demodaten außerdem jederzeit zurücksetzen.</li>
        <li><B>Angaben zu freigebenden Personen und Buchungslinks:</B> so lange wie die zugehörige Buchung bzw. der Link.</li>
        <li><B>Hosting-Logs:</B> werden von Lovable nach kurzer Zeit automatisch gelöscht.</li>
        <li><B>Cookies und Browserspeicher:</B> siehe Abschnitt 3.</li>
      </UL>

      <H2 id="rights">10. Ihre Rechte</H2>
      <P>Sie haben das Recht auf:</P>
      <UL>
        <li>Auskunft über die zu Ihnen gespeicherten Daten (Art. 15 DSGVO),</li>
        <li>Berichtigung falscher Daten (Art. 16); vieles können Sie unter „Profil &amp; Orte“ selbst ändern,</li>
        <li>Löschung (Art. 17) oder Einschränkung der Verarbeitung (Art. 18),</li>
        <li>Erhalt der von Ihnen bereitgestellten Daten in einem maschinenlesbaren Format (Art. 20),</li>
        <li>Widerspruch gegen Verarbeitungen, die auf einem berechtigten Interesse beruhen (Art. 21).</li>
      </UL>
      <P>Schreiben Sie dazu an <Contact email={email} missing={missing} />, am besten von der E-Mail-Adresse Ihres Kontos. Sie erhalten innerhalb eines Monats eine Antwort.</P>
      <P>Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, etwa bei der für uns zuständigen: <Ext href={LFDI}>Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg</Ext>, Lautenschlagerstraße 20, 70173 Stuttgart.</P>

      <H2 id="other">11. Weitere Hinweise</H2>
      <P>Zum Ansehen der Website müssen Sie keine personenbezogenen Daten angeben; für eine Buchung sind die als Pflicht markierten Felder nötig. Angebote und Truck-Pläne werden automatisch aus den Event-Angaben berechnet (Datum, Ort, Gäste, Ernährung und Zeiten). Die Berechnung bewertet das Event, nicht Sie als Person.</P>
      <P>Wenn TruckOps Daten künftig auf neue Weise verarbeitet, aktualisieren wir zuerst diese Seite und das Datum oben.</P>
    </>
  );
}
