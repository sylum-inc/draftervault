# Test fixtures

`auction-sheet.txt` is the commissioner's real sixty, exactly as it was
circulated — one player a line, "Name POS Club", with the apostrophes and the
club abbreviations the sender happened to use.

It is here rather than generated because generating one defeats the purpose.
Every synthetic sheet this repo has ever tested against was the best N players
by our own surplus, which is precisely the shape a real sheet is not: a
commissioner picks off consensus, so his list holds players we price at $2 and
leaves out players we price at $30. Driving this file through the import found
two pricing bugs no synthetic sheet had reached — a value curve permuted across
the sheet boundary leaking $436 of the room's budget onto players nobody was
going to bid on, and a club abbreviation ("AZ") that blocked the position token
before it and failed a correctly spelled name.
