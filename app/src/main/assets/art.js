(function(global){
'use strict';
// 2.0 sticker art: each muscle group has one pastel colour, each piece of equipment one sticker.
const MUSCLE={'胸':'chest','背':'back','腿':'leg','臀':'leg','小腿':'leg','肩':'shoulder','二头':'arm','三头':'arm','核心':'core'};
const EQUIPMENT={'杠铃':'barbell','哑铃':'dumbbell','器械':'stack','绳索':'cable','自重':'mat','壶铃':'kettlebell'};
const GROUP={chest:'barbell',back:'latbar',leg:'sneaker',shoulder:'dumbbell',arm:'arm',core:'mat'};
const color=muscle=>MUSCLE[muscle]||'core';
const S=(name,size=32)=>`<img class="mf-sticker" src="icons/${name}.svg" width="${size}" height="${size}" alt="" aria-hidden="true" draggable="false">`;
const tint=muscle=>'t-'+color(muscle);
// Equipment sticker for an exercise, falling back to its muscle group's sticker.
function exercise(state,e){if(!e)return 'dumbbell';const eq=global.MeowTraining?.equipment(state,e);return EQUIPMENT[eq]||GROUP[color(e.muscle)];}
// Sticker for a set of muscles (a plan or a workout): the first muscle decides.
const group=muscles=>GROUP[color((muscles||[])[0])]||'dumbbell';
global.MeowArt={S,tint,color,exercise,group,GROUP};
})(window);
