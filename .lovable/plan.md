## Mängu kontseptsioon

**F16 Fury** — retro pikslikunsti stiilis side-scroller arcade-mäng, kus juhid F16 hävitajat ja võitled UFO-de lainetega. Mängitav otse brauseris (Lovable URL-il), hiljem saab soovi korral pakendada ka .exe-ks.

## Mehaanika

**Juhtimine (klaviatuur):**

- Nooled / WASD — lendamine (üles/alla/edasi/tagasi)
- Tühik — kuulipilduja (lõpmatu, põhirelv)
- J — laser (kulutab manat)
- K — pomm (kulutab manat, suur kahju)
- Shift + nool — tünnirull / looping (trikk)

**Vaenlased:**

- Väikesed UFO-d (kiired, sik-sak liikumine)
- Suured emalaevad (palju HP, tulistavad plasmat)
- Pommitajad-UFO-d (heidavad pomme alla)
- Boss iga 5 laine järel

**Mana süsteem:**

- Mana riba täitub trikkide tegemisel
- Kulub laserite ja pommide kasutamisel
- Kui mana täis (100%) → +1 elu ja riba läheb nulli

**Trikid (annavad manat):**

- Akrobaatika (tünnirull, looping) → +10 mana
- Lähedalt möödalend (UFO-st või kuulist <30px) → +5 mana, näitab "NEAR MISS!" teksti
- Kombo tapmised (3+ vaenlast 2 sekundi jooksul) → +15 mana, näitab combo-loendurit
- Täpsuslasud (snaipri-stiilis kaugelt tabamus) → +8 mana

**Elud:** algul 3, mana täis → +1 elu, bossi võit → +1 elu.

## Visuaalne stiil

Retro 80ndate arcade pikslikunst: tume taevas tähtedega, paralaks-pilved/mäed, neoon-roosa/tsüaani HUD, CRT scanline overlay, pikslipõhised plahvatused ja partiklid, chiptune-helid (Web Audio API-ga genereeritud).

## Tehniline arhitektuur

**Stack:** HTML5 Canvas + TypeScript, integreeritud TanStack Start raamistikku.

```text
src/
  routes/
    index.tsx          → Avaleht: start / edetabel / juhised
    play.tsx           → Mängu canvas
  game/
    engine.ts          → Mängutsükkel (requestAnimationFrame)
    entities/          → player (F16), enemies (UFO-d), projectiles, particles
    systems/           → input, mana, tricks-detektor, spawner, audio
    render/            → sprites, hud, effects (scanline, screen shake)
  assets/sprites/      → PNG pikslisprite'id
```

**Sprite'id:** genereerin pikslikunsti F16 ja UFO sprite'id läbipaistva taustaga `imagegen` kaudu.

**Skoori salvestus:** localStorage (top 5 lokaalset skoori). Globaalse edetabeli soovi korral saame hiljem lisada Lovable Cloud.

## Mida ehitan esimeses iteratsioonis

1. Canvas + mängutsükkel + F16 juhtimine
2. Kuulipilduja + UFO vaenlane + kokkupõrked
3. Mana süsteem + laser + pomm
4. Trikkide detektor (kõik 4 tüüpi) + visuaalne tagasiside
5. Lainete spawner + raskuse kasv + boss iga 5. laine järel
6. HUD, game over ekraan, localStorage edetabel
7. Retro polish: scanlines, screen shake, chiptune helid, partiklid

## Avatud küsimused (võime hiljem otsustada)

- Mobiilse touch-juhtimise tugi (vaikimisi: ei)
- .exe pakendamine Electroniga (saame teha kui põhimäng valmis ja sulle meeldib)
