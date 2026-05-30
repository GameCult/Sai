VAR noticed_surveillance = false

# scene: agora
# speaker: Void
# sprite: welcome@left
Ink is not alive by itself. A page gives it a body.

* [Let the page speak plainly.]
    ~ noticed_surveillance = true
    # speaker: Aqua
    # sprite: listen@right
    Then the story should feel like it belongs here, not like a widget escaped from somewhere else.
    -> gather
* [Ask for a little theatre.]
    # speaker: Nibu
    # sprite: sharp@right
    A little theatre is allowed. It just has to serve the line instead of eating it.
    -> gather

=== gather ===
# speaker: Void
# sprites: Void.idle@left, Aqua.idle@right
Good. The brush moves. The scene answers.
-> END
