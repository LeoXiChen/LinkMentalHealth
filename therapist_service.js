var googleMapsClient = require('@google/maps').createClient({
    key: 'AIzaSyBj_IpEA7qaOD1njrmlKx5fpwGzc-81DG0'
});

const weights = {
                gender: 10,
                lang: 10,
                religion: 10,
                income: 50,
                agegroup: 1,
                institution: 50,
                life: 15,
                insurance: 0    //  Note: Temporary placeholder.
            };

module.exports.weighTherapist = (therapist, preferences) => {

    return new Promise((resolve, reject) => {

        try{
            //  initialize new property inside therapist
            therapist.score = 0;

            //  for each property inside preferences
            for(prop in preferences){

                if(therapist.hasOwnProperty(prop)){
                    //  check if property holds an array
                    if(therapist[prop] instanceof Array){

                        //  check if preference property exists inside therapist property array.
                        if(therapist[prop].indexOf(preferences[prop]) > -1){
                            therapist.score += weights[prop];   //  increment score
                        }
                    }
                    //  if therapist property value equals preferences property value.
                    if(therapist[prop] === preferences[prop]){
                        therapist.score += weights[prop];    //  increment score
                    }
                }

            }

            getDistance(preferences.location, therapist.location)
            .then(data => {
                therapist.distance = data.distance.text;
                therapist.duration = data.duration;

                // circumference of earth in meters subtracted by distance to therapist
                therapist.score += (40075000 - data.distance.value) * Math.pow(10, -7) + (data.distance.value <= 10000 ? 20 : 0);    //  +20 to give priority to therapists within 10 km of user

                resolve(therapist);
            })
            .catch(err => console.log(err));

        } catch(e){
            reject(`Error: ${e.message}`)
        }
    })
}

//  Note: Algo is meant to populate carousel in the landing page.
//  Returns a promise that resolves a matrix of 2 rows and 3 columns.
//  TODO:   Polish for matrices of different rows and column sizes. (Reusability)
module.exports.createMatrix = (public, private) => {
    return new Promise((resolve, reject) => {

        let carousel = [];

        for(let i = 0; i < 2; i++){

            let row = [];
            for(let j = 0; j < 3; j++){
                if(j !== 2){

                    //  flag random index
                    let random = Math.floor(Math.random() * private.length);

                    row.push({
                        imageURL: private[random].photo_link,
                        name: private[random].name,
                        summary: private [random].short_summary
                    });

                    private.splice(random, 1);  //  remove and prevent any repeat calls to this therapist.
                } else{

                    //  flag random index
                    let random = Math.floor(Math.random() * public.length);
                    row.push({
                        imageURL: public[random].photo_link,
                        name: public[random].name,
                        summary: public [random].short_summary
                    });

                    public.splice(random, 1);   //  remove and prevent any repeat calls to this therapist.
                }
            }
            carousel.push(row);
        }

        //  wait for carousel array to finish populating.
        Promise.all(carousel).then(data => {

            //  destructure array into 2 rows and 3 columns
            data.reduce((acc, curr, index, array) => {
                if(index % 3 === 0)
                    acc.push(array.slice(index, index + 3));
                return acc;
            });

            resolve(data);
        })
    })
}

function getDistance(location, therapistLocation){
    return new Promise((resolve, reject) => {

        googleMapsClient.distanceMatrix({
            origins: [location],
            destinations: [therapistLocation],
            mode: 'driving',
            departure_time: new Date().getTime() + 60 * 60 * 1000,  //  in one hour.
            units: 'metric',
            avoid: ['tolls', 'ferries'],
            traffic_model: 'best_guess'
        }, function(err, response) {
            if (!err) {
                resolve({
                    distance: response.json.rows[0].elements[0].distance,
                    duration: response.json.rows[0].elements[0].duration.text
                })
            } else {
                reject(err)
            }
        });

    })
}
