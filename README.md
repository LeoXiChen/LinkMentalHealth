# LinkMentalHealth

## Getting started:

These commands will need to pasted into a terminal:

1. `/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"`

2. `brew install node`

3. Inside terminal, navigation (cd) to root directory of the project. This is the directory contains the server.js file etc.

4. Run `npm install`

5. Run `MONGODB_URI=mongodb://linkmentalhealth:PASSWORD@ds153869.mlab.com:53869/heroku_jf7kk41h node server.js` replace PASSWORD with assigned password

6. Open a browser and go to [http://localhost:8080/api/therapistMatrix](http://localhost:8080/api/therapistMatrix)

If you see some text, congratulations, you've set up LinkMentalHealth locally.

Go to [http://localhost:8080](http://localhost:8080) to access the main website and fill out the questionnaire.

You can make changes locally (to both backend and frontend), but you'll need to restart the server. Kill the server by pressing `Control+C` on the keyboard (while the terminal window with the server running is in focus) and repeating just Step 5 above. You could also easily close the terminal window and repeat steps 3 - 6.


# User & Therapist Matching Algorithm (Tutorial)

## results.html (Client)

User preferences are extracted from the browser's URL and formatted into a JSON object:

#### Parsing URL parameters for user preferences at line 285

```javascript
    var _params = window.location.search.substr(1); 
    _params = '{"' + _params.replace(/&/g, '","').replace(/=/g, '":"') + '"}', function (key, value) { return key === "" ? value : decodeURIComponent(value) }
    _params = JSON.parse(_params);  //  Note: user preferences to be sent
    
    
    for(prop in _params){
        if(prop === "location"){
            _params[prop] = decodeURIComponent(_params[prop]);
        }
        if(_params[prop].indexOf('+') > -1){
            _params[prop] = _params[prop].split('+').join(' ');
        }
        _params[prop] = decodeURIComponent(_params[prop])
    }
```


Post request and attached user preferences object (Line 312) are sent to server route /api/matchUsingScore:

#### POST request to server at line 308

```javascript
     $.ajax({
            type: 'POST',
            url: '/api/matchUsingScore',
            dataType: 'json',
            data: JSON.stringify(_params),  //  Note: user preference object is attached here.
            contentType: 'application/json',
```

## server.js (Server)

Server recieves the request and builds a filter for therapists based on the user preferences:

#### /api/matchUsingScore route at line 276

```javascript
app.post("/api/matchUsingScore", function (req, res) {

    let filter = {};

    //set filters
    switch(req.body.income){    //  Note: req.body holds the user's preferences
        //  if < 40,000
        case "<$40,000": 
            //  check if student
            switch(req.body.booking){
                case "UOFT":
                case "RYE":
                case "UTM":
                    filter.publicprograms = null   //  get ONLY private therapists
                break;
                default:
                    filter.publicprograms = "yes";  //  if NOT student, get ONLY public programs
                break;
            }
        break;
        case "$60,000-$100,000":
        case "$100,000+":
            filter.publicprograms = null;   //  get ONLY private therapists for income > 60,000
        break;
    }
```

The filter is passed into a request to MongoDB and returns an array of therapists that align with the user's preferences (Line 303):

```javascript
    //  search THERAPIST_COLLECTION using filter
    db.collection(THERAPISTS_COLLECTION).find(filter).toArray(function (err, therapists) {
```

We recieve the array of therapist objects from MongoDB and build a new array of therapist objects with an added
score property related to the user's preferences using the ```therapist_service``` (Line 310):

```javascript
    //  create new array using map
    let therapist_list = therapists.map(therapist =>

        //  Note: I will speak more on what is happening here in the "therapist_service.js" section (SCROLL DOWN)
        therapist_service.weighTherapist(therapist, req.body).then(therapistObj => {
            return therapistObj;
        }).catch(err => console.log(err))
    );
```

We must then wait for ```therapist_list``` to finish populating because NodeJS is asynchronous.
Eventually, when the array finishes populating itself we send a JSON response back to the client (Line 316):

```javascript
    //  wait for array to finish
    Promise.all(therapist_list).then(arr => {
        arr.sort((a, b) => b.score - a.score);  //  sort array descending
        res.status(200).json(arr.slice(0, 10)); //  return first 10
    }).catch(err => console.log(err));
```

## therapist_service.js (Therapist Service Module)

This function receives a therapist object and a preferences object and returns a promise (Line 17) which
resolves (Line 52) a therapist object with an added score property.

We loop through each property inside the preferences object and check to see if the therapist object
holds the same property. If both objects contain a property we then check if the value inside both
properties also match. 

Note:   For cases where the therapist object's property may contain an array we check if the datatype of 
        that property is an instance of Array (or holds a constructor of Array). Also, if it is an array 
        we make a check (Line 31) for whether or not that user preference exists inside that array. Finally,
        if it exists then we add the weighted score for that property to the therapist object. (Line 32)

#### weighTherapist Function at Lines 15

```javascript
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

                console.log(therapist.score);
                resolve(therapist);
            })
            .catch(err => console.log(err));

        } catch(e){
            reject(`Error: ${e.message}`)
        }
    })
}
```

We calculate distance by first calling the getDistance function which recieves the user's location and the therapist's
location. It returns a promise which makes a request to the Google Maps API (Line 120) and resolves the promise using the 
response data's duration and distance property values (Line 130):

#### getDistance Function at Lines 117

```javascript
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
                    distance: response.json.rows[0].elements[0].distance,   //  grab distance object
                    duration: response.json.rows[0].elements[0].duration.text   //  grab duration object's text value
                })
            } else {
                reject(err)
            }
        });

    })
}
```

We then use the returned data from our getDistance function and score the therapist:

```javascript
getDistance(preferences.location, therapist.location)
            .then(data => {
                therapist.distance = data.distance.text;
                therapist.duration = data.duration;

                // circumference of earth in meters subtracted by distance to therapist
                therapist.score += (40075000 - data.distance.value) * Math.pow(10, -7) + (data.distance.value <= 10000 ? 20 : 0);    //  +20 to give priority to therapists within 10 km of user

                console.log(therapist.score);
                resolve(therapist);
            })
```

Typical formula for calculating the score for distance is:
```javascript
    (40075000 - data.distance.value) * Math.pow(10, -7)     // (40_075_000 - <USER DISTANCE>) * 10^-7
```

However, when the distance is less then 10km we add a weighted score of 20 to prioritize the user's preferences 
which translates to:

```javascript
(40075000 - data.distance.value) * Math.pow(10, -7) + (data.distance.value <= 10000 ? 20 : 0);

//  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_Operator
//  See above link for more information on (?:) Ternary Operators
```