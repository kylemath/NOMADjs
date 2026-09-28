Note that there are 32 light source channel boxes under each detector.   You have 8 light sources in each bank, but 4 frequencies.  Boxy already is sorting it all out. You have 32 independent AC and Phase results.  You have only 8 indipendant DC results, one for each time multiplex channels.  The boxy data file will be the same as it would have been in the old switch-32 mode.  That is there will be a AC, DC and phase result for every combination of light sources and detectors.  (Only the DC will be a sum for all the diodes on in the same time multiplex channel), but the AC and phases will be calculated for all.  Boxy has data (at least AC and Phase from 32 external mux channel consisting of 8 time multiplex channels times 4 frequency multiplex channels.).   In switch-8 mode (with frequency multiplexing on) there in fact 8 time multiplex channels and each of your four banks of laser diodes are modulated at a different frequency.  The only thing you need to know is how the EMC (external mux channels) in boxy relate the to the laser banks and number.

 

EMC 1-8 are bank A1-8 laser diodes

 

EMC 9-16 are bank B1-8 laser diodes

 

EMC 17-24          are the signals form bank C lasers

 

EMC 25-32 are the signals form bank D lasers.

 

 

Do not forget 2 things.  There is on your harddrive a power point about what is new in the software for Imagent 2.   Second, fix Nomad to have a shorter minimum distance between for light source channels sharing a time multiplex channel  (Like A1, B1, C1 and D1), but do not allow a shorter source detector distance to compete with any you plan to measure.   For example, if light source A1 is 3cm from a given detector, do not attempt to measure it when light source B1 is closer than 3cm to the same detector.  Actually I might make this minimum distance for B1 at least 1cm longer than the diode you want to measure.  Otherwise you will get the noise from diode B1 cast into the AC and phase error on diode A1.   Frequency multiplexing has it limits, it is just better than not having it.