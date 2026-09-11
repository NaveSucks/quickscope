# Map draft and route checklist

Coordinates are metres, Y up. The original-era overhead schematic is sampled
with plan origin at pixel (240,315), scale 0.24 m/px. This preserves proportional
placement of the two red pits, east-offset helipad, north mail/store/cafe wing,
and south executive offices. Vertical heights remain tuned estimates: deck Y=0,
pits Y=-3.6, helipad Y=2.4, office roofs Y=4.9. It is not an exact survey of the
original game's collision mesh.

Reference used for proportional authoring (viewed, not included in assets):
- [Original-era overhead schematic](https://modernwarfaretutorials.blogspot.com/2012/01/high-rise-map-modern-warfare-2.html)
- [Original MW2 crane footage](https://www.youtube.com/watch?v=BJYhZ620SCY)
- [Official remaster guide](https://www.callofduty.com/guides/multiplayer-maps/call-of-duty-modern-warfare-iii-play-maps-core-multiplayer-map-guide-highrise),
  consulted as a cross-check; remaster traversal can differ.

Pending manual comparison with original MW2 footage and route validation:
- [ ] Office-to-office spawn sightlines and cover placement.
- [ ] Both flanks around central helipad.
- [ ] Both office stairs into the lower connector and exits.
- [ ] Crane access, boom run and office ledge transfer.
- [ ] East scaffold jump and climb.
- [ ] Narrow east/south perimeter ledges and executive rooftop mantle.
- [ ] West crane-to-mail-office ledge and roof access.
- [ ] Utility roof traversal and sightlines.
- [ ] Every spawn is reachable, clear and reasonably safe.
- [ ] Jump/collision equivalence in two browsers at 50–150ms RTT.

Jump initial velocity 8m/s, gravity 22m/s², sprint 8.4m/s gives approximately
1.45m apex and 6.1m same-height horizontal range. Ladders and authored mantle
points provide necessary greater elevation changes. No invisible arena walls;
falls below Y=-15 kill without changing kill score.
