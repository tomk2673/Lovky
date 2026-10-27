# LOVKY

Mobilní web pro sběr nezávazných poptávek podnikatelského financování se zajištěním nemovitosti a soukromou evidenci leadů pro jednoho partnera.

## Hotové chování

- Tříkrokový formulář bez uploadu dokumentů, scoringu a automatického schvalování.
- Trvalé ukládání v D1. Potvrzení se zobrazí až po uložení.
- Serverová validace, souhlas, verze informačního textu, čas a identita příjemce.
- Idempotentní odeslání včetně souběžných pokusů, kontrola původu, limit velikosti a četnosti.
- Soukromá správa: hledání, filtry, stránkování, detail a historie změn.
- Stavy Nová / Řeší se / Předána / Realizována / Uzavřena.
- Poznámka, očekávaná a zaplacená provize v celých haléřích. Modelové provize neovlivňují součty výdělků.
- CSV pro partnera podle filtru (max. 1 000 záznamů) a kopírování jednoho přehledu. Interní poznámky a provize do exportu nevstupují.
- Kontrola verze chrání změny proti přepsání z jiné otevřené záložky. Historie se zapisuje databázovým triggerem v téže transakci.
- Smazání leadu odstraní i jeho historii. Je nevratné a vyžaduje potvrzení v aplikaci.

## Aktuální režim

Výchozí režim je **pilot**. Formulář přijímá pouze pevně dané modelové kontakty z `TEST_CONTACT`; server jinou identitu odmítne. Částku a další podnikatelské parametry lze při testu měnit. Aplikace sama nikomu neposílá zprávy a neobsahuje externí CRM napojení.

Předávání investorovi se provádí ručně pomocí exportu; stav „Předána“ se nastavuje až po skutečném předání. Pro automatické napojení jsou potřeba údaje konkrétního partnera a jeho rozhraní.

## Pro ostrý provoz

Názvy nastavení jsou v `.env.example`. Hodnoty patří do runtime nastavení hostingu, nikoli do zdrojového kódu.

1. Nastavit účet správce (`ADMIN_EMAIL`). Přístup ověřují serverové hlavičky důvěryhodné přihlašovací vrstvy Sites, nestačí přihlášení jiného uživatele.
2. Doplnit identitu provozovatele a skutečného příjemce: název, IČO, sídlo a kontaktní e-mail pro údaje. Potvrdit rozsah služby a informace o zpracování podle skutečného obchodního vztahu. Samotné uvedení IČO neprokazuje podnikatelský účel.
3. S partnerem dohodnout, co se považuje za přijatý lead, způsob předání, duplicity, odměnu a splatnost. Žádná provize není v aplikaci předpokládána.
4. Nastavit `RETENTION_DAYS` (1–365) a náhodný serverový `RATE_LIMIT_SECRET`.
5. Teprve potom nastavit `COLLECTION_MODE=live`. Chybějící nastavení při požadovaném live režimu příjem zastaví. Zpřístupnění veřejnosti a připojení vlastní domény jsou samostatná nastavení hostingu.

Při načtení správy se odstraňují záznamy starší než nastavená doba. Pravidelný úklid bez návštěvy správy zatím není naplánován; při ostrém provozu ho musí provozovatel zajistit. Účetní doklady tento nástroj nenahrazuje.

## Vývoj a ověření

Node.js 24, pnpm nebo kompatibilní prostředí Sites. Závislosti jsou uzamčené v `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
npm test
npm run typecheck
npm run build
```

Testy používají skutečné route handlery s lokálními adaptéry D1 a identity. Testují souběžné opakování, ochranu dat a exportu, souhlas, nepodnikatelský účel, změny verzí, audit, formulářové částky, rate limiting a výmaz. Neodesílají nic partnerům.

Lokální D1 vyžaduje aplikaci migrace:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_goofy_baron_strucker.sql
```

Použité migrace se nepřepisují. Změny schématu se přidávají přes `npm run db:generate`. První migrace obsahuje i auditní triggery.

Sites zajišťuje přihlašovací cesty. Lokální náhled nemusí podporovat přihlášení; do aplikace kvůli tomu nepřidávat obcházení autorizace. Jiný hosting musí důvěryhodnou identitní vrstvu nahradit a nesmí přijímat klientem podvržené `oai-authenticated-user-*` hlavičky.

## Stav nasazení

Soukromý pilot má manifest `.openai/hosting.json`. Zveřejnění vyžaduje zachovat správný projekt a synchronizovat zdroj před publikací. Skuteční investoři, schválené úvěry, zákazníci ani dosažené výnosy nejsou v demo obsahu předstíráni.
