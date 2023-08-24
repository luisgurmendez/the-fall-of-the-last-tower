## Rescue Mission

Submission for js13kb 2021.


![Rescue Mission](/assets/RescueMission.png)



### Gallery 

![Rescue Mission Screenshot](/assets/RescueMissionScreenshot.png)


### Objective:
The game has a simple task. Rescue as much (3 per level) astronauts as possible and then make a safe landing on the blue planet,
for landing the rocket one should go slowly and as much perpendicular to the planet as possible. Don't forget to use the gravity wisely...

### Controls
Tipical wasd movement. Also has zooming, moving, draging camera as expected,something like Google Maps
p - pause/unpause
m - toggle menu
r - restart level
x - increase game speed
z - decrease game speed
' ' - make camera follow rocket 

### Package
To create the final .zip that was submitted run:
1. `yarn`
2. `yarn package`

### Development
For running things locally..
1. `yarn dev`
   

### Why this project?

I've been wanting to experience game development for a while and being a total noobie in this area, maked this competition a preasure for me to actually start with something.
I also wanted to learn more about the Canvas API and designing the architecture of a game from scratch without
using any third party libraries. 

I endedup writing some kind of flux  + controllers architetcure where all the "state" is inside a Level object and a GameContext was
passed "down" to children objects where they could render/step/decide/initialize/dispose.


One poor implementation was that actually the GameContext isnt immutable, and a children could mutate the state.