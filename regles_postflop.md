# Base de règles postflop du moteur « Coup »

Chaque recommandation de l'app cite une ou plusieurs règles de cette liste. Les règles sont de trois natures :

- **[M] mathématique** : résultat exact, sans opinion.
- **[L] littérature** : principe partagé par les ouvrages et les solveurs, avec des fréquences moyennes.
- **[H] heuristique** : simplification choisie pour le moteur, à corriger avec tes sorties GTO Wizard.

Sources principales : Matthew Janda, *Applications of No-Limit Hold'em* ; Michael Acevedo, *Modern Poker Theory* ; Ed Miller, *The Course* ; blogs GTO Wizard, Upswing, VIP-Grinders, DeucesCracked (articles consultés le 29 octobre 2026).

## 1. Équité et cotes

- **R1 [M] Équité contre une range.** La force d'une main postflop est son pourcentage de victoire contre toutes les combinaisons que l'adversaire peut encore avoir, cartes du board exclues. L'app la calcule par simulation (plusieurs milliers de tirages) à partir des ranges du PDF.
- **R2 [M] Cote du pot.** Payer une mise est rentable si équité ≥ mise ÷ (pot + 2 × mise). Mise d'un tiers du pot : 20 %. Demi-pot : 25 %. Pot : 33 %. Deux fois le pot : 40 %.
- **R3 [M] Fréquence minimale de défense.** Face à une mise, pour ne pas être exploitable il faut continuer avec au moins pot ÷ (pot + mise) de sa range : 75 % face à un tiers de pot, 67 % face à une demi-mise, 50 % face à une mise de pot.
- **R4 [M] Seuil de bluff.** Un bluff est rentable si l'adversaire se couche plus souvent que mise ÷ (pot + mise) : 25 % pour un tiers de pot, 33 % pour une demi-mise, 50 % pour une mise de pot.
- **R5 [M] Ratio bluffs sur valeur à la river.** Pour que l'adversaire soit indifférent, la part de bluffs dans une range de mise polarisée vaut mise ÷ (pot + 2 × mise) : 1 bluff pour 4 mains de valeur à un tiers de pot, 1 pour 3 à demi-pot, 1 pour 2 à pot.
- **R6 [L] Réalisation d'équité.** En position on réalise environ 100 à 110 % de son équité brute, hors position 80 à 90 %. Le moteur applique +5 % en position et −5 % hors position aux seuils de décision.
- **R7 [L] SPR et engagement.** SPR = tapis effectif ÷ pot. SPR ≤ 3 : top paire ou mieux va au tapis. SPR 3 à 8 : top paire bon kicker reste engageable, main moyenne non. SPR > 8 : il faut deux paires ou mieux, ou un très gros tirage, pour jouer pour le tapis.

## 2. Lecture du board

- **R8 [L] Avantage de range.** La range dont l'équité globale est la plus élevée sur le board a l'avantage de range. Elle peut miser plus souvent. L'ouvreur préflop a l'avantage sur les boards hauts (A, K, Q) et secs ; le défenseur sur les boards bas et connectés (765, 986) où ses petites cartes assorties et ses petites paires font des mains fortes.
- **R9 [L] Avantage de nuts.** La range qui contient le plus de mains très fortes (deux paires, brelans, mieux) peut miser plus gros. Sans avantage de nuts, on mise petit même avec l'avantage de range.
- **R10 [L] Texture.** Sec : pas de tirage couleur ni quinte possible à quatre cartes (K72 rainbow). Dynamique : deux cartes de la même couleur ou trois cartes rapprochées (J T 8, 9 8 5 assorties). Monotone : trois cartes de la même couleur, les deux ranges sont écrasées, on mise beaucoup moins. Board pairé : moins de deux paires possibles, l'avantage de nuts va à celui qui a le plus de brelans et de full possibles.
- **R11 [L] Cartes de turn.** Une carte haute (A, K, Q) renforce la range de l'ouvreur. Une carte qui complète un tirage renforce le défenseur. Une carte qui pair le board est neutre ou légèrement favorable à celui qui a le plus de brelans. Une carte basse sans rapport est neutre.

## 3. Mise au flop

- **R12 [L] Pourquoi miser.** On mise pour la valeur (une main moins bonne paie) ou pour faire coucher une main meilleure ou de l'équité. Si aucune des deux raisons n'existe, on checke. Une main qui a de la valeur de showdown mais qui ne sera payée que par mieux checke.
- **R13 [L] C-bet petit et fréquent.** Sur un board sec où l'ouvreur a l'avantage de range (équité de range ≥ 55 %), il mise un tiers du pot avec la majorité de sa range, mains faibles comprises. Fréquence solveur de l'ordre de 75 à 90 % sur K72 rainbow.
- **R14 [L] C-bet gros et polarisé.** Sur un board dynamique, ou avec l'avantage de nuts, on mise deux tiers à trois quarts du pot avec les mains fortes et les gros tirages, et on checke les mains moyennes.
- **R15 [L] Monotone et bas connecté.** Fréquence de c-bet réduite d'environ deux tiers. On mise seulement avec les mains fortes et les tirages à la couleur max.
- **R16 [L] Pots 3bet.** L'agresseur a un avantage de range plus net : c-bet 70 à 85 % du temps, un tiers du pot, SPR faible donc engagement rapide avec top paire ou mieux (R7).
- **R17 [H] Classement de la main pour le moteur.** Valeur forte : deux paires ou mieux, overpaire, top paire kicker ≥ J. Valeur moyenne : top paire kicker faible, deuxième paire, paire moyenne. Tirage fort : 8 outs ou plus (couleur, quinte ouverte, combinés). Tirage faible : 4 à 7 outs. Showdown : as haut sur board sec, petite paire. Air : le reste.
- **R18 [H] Décision agresseur au flop (personne n'a misé).** Valeur forte : mise (taille selon R13/R14). Tirage fort : mise, semi-bluff. Valeur moyenne : mise petite si R13 s'applique, sinon check. Showdown et air : mise petite si R13 s'applique et que le board ne touche pas la range adverse, sinon check.
- **R19 [H] Décision défenseur au flop (il a checké).** L'adversaire qui checke a une range plafonnée. On mise la valeur forte et moyenne, et les tirages forts. On checke derrière avec showdown et air sauf si le board est très mauvais pour lui.

## 4. Face à une mise

- **R20 [M+H] Payer.** On compare l'équité contre la range de mise adverse (range réduite par R24) à la cote du pot (R2), corrigée par la position (R6). Marge de sécurité de 5 % pour un call sans tirage aux nuts.
- **R21 [L] Relancer.** Relance pour la valeur avec deux paires ou mieux face à une petite mise, et avec top paire bon kicker face à une mise petite sur board dynamique. Relance en semi-bluff avec les tirages combinés (12 outs et plus) quand le SPR permet encore un fold adverse.
- **R22 [L] Cotes implicites.** Un tirage aux nuts avec SPR > 4 peut payer jusqu'à 5 points d'équité sous la cote du pot. Un tirage non aux nuts (couleur basse, quinte au bout bas) ne bénéficie pas de cette marge.

## 5. Lecture des actions adverses

- **R23 [H] Il mise au flop en tant qu'agresseur.** Sa range de mise garde ses mains de valeur, ses tirages, et une part de ses mains faibles proportionnelle à la fréquence de c-bet attendue sur ce board (R13 à R15).
- **R24 [H] Il mise en tant que défenseur, ou à la turn et à la river.** Sa range de mise se resserre sur valeur moyenne et plus, et tirages forts. Les mains sans rien sont retirées, sauf profil agressif.
- **R25 [H] Il checke.** Sa range perd la majeure partie de ses mains fortes (il les aurait misées), sauf 30 % conservées pour le slowplay. Elle garde les mains moyennes, les tirages et l'air.
- **R26 [H] Il paie une mise.** Sa range garde les paires, les tirages et les mains à showdown. Il perd l'air. Plus la mise est grosse, plus les paires faibles disparaissent.
- **R27 [H] Il relance.** Sa range se réduit aux mains fortes (deux paires et mieux, top paire top kicker) et aux tirages combinés. Face à un profil agressif, on y ajoute des tirages simples et des bluffs.

## 6. Turn

- **R28 [L] Deuxième barrel de valeur.** On continue de miser une main de valeur forte ; une main de valeur moyenne mise si la turn est neutre ou favorable (R11), checke sinon.
- **R29 [L] Deuxième barrel en bluff.** Seulement si la turn améliore notre position : overcarte qui favorise notre range, ou tirage supplémentaire pour nous. Air sur turn neutre ou défavorable : on abandonne.
- **R30 [L] Tirages à la turn.** Un tirage fort mise encore en semi-bluff si le SPR laisse de la fold equity ; sinon il checke et paie selon R2 et R22.

## 7. River

- **R31 [M] Force à la river.** Plus de tirage : la force est la part de la range adverse que notre main bat.
- **R32 [L] Mise de valeur.** On mise si notre main bat plus de la moitié des mains qui vont payer, approximé par : bat ≥ 60 % de la range adverse. Grosse mise (75 % du pot ou plus) si on bat ≥ 80 %, mise moyenne sinon.
- **R33 [L] Bluff à la river.** Candidats : mains sans valeur de showdown (bat < 15 % de la range adverse) qui bloquent ses mains de valeur et ne bloquent pas ses mains faibles. On bluffe si la part de la range adverse qui ne peut pas payer dépasse le seuil R4 pour la taille choisie. Sinon on abandonne.
- **R34 [M+H] Payer une mise à la river.** On suppose la range de mise adverse composée de ses meilleures mains plus une part de bluffs donnée par R5 (ajustée par le profil). On paie si la part de cette range que l'on bat est ≥ cote du pot R2.
- **R35 [L] Showdown.** Une main qui bat entre 15 % et 60 % de la range adverse checke : trop faible pour la valeur, trop forte pour bluffer.

## 8. Profil adverse

- **R36 [H] Se couche trop.** Seuil de bluff abaissé de 10 points, bluffs à la turn et à la river autorisés plus souvent, mises de valeur fines découragées.
- **R37 [H] Paie trop.** Pas de bluff à la river, mises de valeur plus fines (bat ≥ 50 %), tailles de valeur augmentées.
- **R38 [H] Relance et mise trop.** Ses ranges de mise et de relance contiennent plus de bluffs : on paie plus large (seuil R34 abaissé), on relance moins en bluff, on checke plus souvent les mains moyennes pour le laisser bluffer.

## 9. Limites connues

- Un seul adversaire. En multiway les fréquences de bluff chutent fortement et le moteur ne doit pas être utilisé.
- Les ranges adverses sont celles du PDF, donc celles d'un bon joueur régulier. Un joueur qui joue beaucoup plus de mains préflop fausse la lecture du board.
- Les spots serrés (valeur fine, bluff-catch) restent des estimations. Le moteur le signale avec un niveau de confiance et GTO Wizard reste la référence.
