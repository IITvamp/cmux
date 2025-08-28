export const kitties = [
  // kitty1
  `\
  /\\_/\\     
 ( =.= )
 (>   <)>☕`,
  // kitty2
  `\
/\\_/\\
(='.'=)
(")_(")`,
  // bunny
  `\
(\\  /)
( ^.^ )
c(")(")`,
];

export function getRandomKitty() {
  return kitties[Math.floor(Math.random() * kitties.length)];
  // return kitties[0];
}
