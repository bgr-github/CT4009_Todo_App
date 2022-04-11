const app = new Vue({
    el: "#app", /* The HTML element that holds our application */
    data: {
        /* Data is a JavaScript object which holds the data in our application */
        database: null,
        todos: [],
        editingTodo: {
            title: "",
            description: "",
            priority: "",
            dueDate: null,
            timeDue: null,
            isComplete: false,
            images: [],
            location: null
        },

        /* We use newTodo as the values are dynamically updated as the user types using VueJS' models
        and we can then submit the data once the user is ready. */
        newTodo: {
            title: "",
            description: "",
            priority: "",
            dueDate: null,
            timeDue: null,
            isComplete: false,
            images: [],
            location: null
        },
        modals: {
            background: false,
            createTodo: false,
            editTodo: false,
            help: false,
            map: false
        },
        map: null
    },
    async created() {
        /* This function is called when the VueJS app is loaded */
        this.database = await this.getDatabase();
        this.todos = await this.getTodos();
    },
    methods: {
        /* Methods is a JavaScript object which stores the functions we use in the application
           I return Promise objects so we can properly use data inside IndexedDB callbacks */
        async addTodo() {
            return new Promise((resolve, reject) => {
                let tx = this.database.transaction(["todos"], "readwrite");
                tx.oncomplete = e => resolve();

                let store = tx.objectStore("todos");
                /* This is where the values in newTodo are added to the database, creating a new todo item. */
                store.add({
                    title: this.newTodo.title,
                    description: this.newTodo.description,
                    priority: this.newTodo.priority,
                    dueDate: this.newTodo.dueDate,
                    timeDue: this.newTodo.timeDue,
                    isComplete: this.newTodo.isComplete,
                    images: this.newTodo.images,
                    location: this.newTodo.location
                });
                
                /* Reset the todos array, and grab todos from the database
                as they need a database ID, and they won't have one if I just add them to the HTML document. */
                this.getTodos();
                
                /* Reset the newTodo variable, so that it's ready to be used again without manually clearing
                   the textboxes. */
                this.newTodo = {
                    title: "",
                    description: "",
                    priority: "",
                    dueDate: null,
                    timeDue: null,
                    isComplete: false,
                    images: [],
                    location: ""
                };
            })
        },
        async editTodo(todo) {
            return new Promise((resolve, reject) => {
                let tx = this.database.transaction(["todos"], "readwrite");
                tx.oncomplete = e => resolve();

                let store = tx.objectStore("todos");
                /* This is where the values in newTodo are added to the database, creating a new todo item. */

                store.put(this.editingTodo);
                
                /* Reset the todos array, and grab todos from the database
                as they need a database ID, and they won't have one if I just add them to the HTML document. */
                this.getTodos();
                
                /* Reset the newTodo variable, so that it's ready to be used again without manually clearing
                   the textboxes. */
                this.editingTodo = {};
                this.newTodo = {
                    title: "",
                    description: "",
                    priority: "",
                    dueDate: null,
                    timeDue: null,
                    isComplete: false,
                    images: [],
                    location: ""
                };
            })
        },
        async completeTodo(todo) {
            return new Promise((resolve, reject) => {
                todo.isComplete = !todo.isComplete; // Switches the isComplete status of the todo.
                let tx = this.database.transaction(["todos"], "readwrite");
                tx.oncomplete = e => resolve(); // Resolving the todo is a Promise callback which returns data from IndexedDB.

                let store = tx.objectStore("todos");
                store.put(todo);
            })
        },
        async removeTodo(todo) {
            return new Promise((resolve, reject) => {
                let tx = this.database.transaction(["todos"], "readwrite");
                tx.oncomplete = e => resolve();

                /* We grab the array index of the todo, and remove the todo from the array (this.todos)
                so that it is removed from the list in real time */
                let todoIndex = this.todos.indexOf(todo);
                this.todos.splice(todoIndex, 1);

                /* After deleting the todo from the HTML document and the todos array, we remove it from the database. */
                let store = tx.objectStore("todos");
                store.delete(todo.id);
            });
        },
        async removeSelected() {
            /* This function loops through each todo, if they are selected and the user confirms,
            they are deleted. I would call removeTodo() on each todo, but due to array.splice I receive a
            programmatic error, so I decided to delete them all together by calling this.getTodos() after
            removing from the database. */
            if(confirm("Are you sure you want to delete the selected tasks?")) {
                return new Promise((resolve, reject) => {
                    let tx = this.database.transaction(["todos"], "readwrite");
                    let store = tx.objectStore("todos")

                    tx.oncomplete = e => resolve();

                    this.todos.forEach(t => {
                        if(t.selected) {
                            store.delete(t.id);
                        }
                    });

                    this.getTodos();
                });
            }
        },
        async getTodos(timeframe=null) {
            return new Promise((resolve, reject) => {
                /* Reset the todos array so that we aren't duplicating any values. */
                this.todos = [];

                let tx = this.database.transaction(["todos"], "readonly");
                tx.oncomplete = e => resolve(this.todos); /* Resolve is a Promise's way of returning data from a callback. */

                let store = tx.objectStore("todos");

                store.openCursor().onsuccess = e => {
                    let cursor = e.target.result;
                    if(cursor) {
                        /* Add the todo to the array, which renders it in the HTML document. */
                        var todo = cursor.value;

                        /* Add any client-side values here which do not touch the database */
                        todo.selected = false;
                        todo.truncated = true;

                        /* This "hack" just displays data in the todos array if it matches a certain criteria. */
                        if(timeframe == "daily") {
                            /* Today's date */
                            let todaysDate = new Date().toJSON().slice(0,10).replace(/-/g,'-');
                            if(todo.dueDate == todaysDate) {
                                this.todos.push(todo);
                            }
                        } else if(timeframe == "weekly") {
                            /* Grabs the day and month from the todo, converts it to an integer and compares it */
                            let today = parseInt(new Date().toJSON().slice(0,10).replace(/-/g,'-').split("-")[2]);
                            let month = parseInt(new Date().toJSON().slice(0,10).replace(/-/g,'-').split("-")[1]);
                            let todoDay = parseInt(todo.dueDate.split("-")[2]);

                            /* The todo is compared to 7 days from now. */
                            if (todoDay <= today+7 && todo.dueDate.split("-")[1] == month) {
                                this.todos.push(todo);
                            }
                        } else if(timeframe == "monthly") {
                            /* This grabs the month as a string and compares it to the current month. */
                            let month = new Date().toJSON().slice(0,10).replace(/-/g,'-').split("-")[1];
                            let monthDue = todo.dueDate.split("-")[1];
                            if(monthDue == month) {
                                this.todos.push(todo);
                            }
                        } else {
                            this.todos.push(todo);
                        }
                        cursor.continue();
                    }
                };
            })
        },
        modalController(modal, todo=null) {
            /* Controls which modals are visible */
            this.modals.background = true;
            switch(modal)
            {
                case "addtodo": {
                    /* Opens the add task modal 
                    When the boolean is switched to true, the class changes on the element to make it visible. */
                    this.modals.createTodo = true;
                    break;
                }
                case "edittodo": {
                    /* Opens the Edit Todo Modal */
                    this.modals.editTodo = true;
                    if(todo != null) {
                        this.editingTodo = todo;
                    }
                    break;
                }
                case "help": {
                    /* Opens the Help Modal */
                    this.modals.help = true;
                    break;
                }
                case "map": {
                    /* Opens the Map Modal and loads the map */
                    this.modals.map = true;
                    this.loadMap();
                    break;
                }
                case "close": {
                    /* Closes all modals if any are open. */
                    this.modals = {
                        background: false,
                        createTodo: false,
                        help: false,
                        map: false
                    }
                }
            }
        },
        async loadMap() {
            /* This function loads the Google Map. */
            var center = new google.maps.LatLng(51.907004609165824, -2.0520652965645096);
            var container = document.getElementById("map");

            this.map = new google.maps.Map(container, {
                zoom: 12,
                center
            });

            this.map.addListener("dblclick", (e) => {
                let lat = e.latLng.toJSON().lat;
                let lng = e.latLng.toJSON().lng;
                
                this.newTodo.location = `${lat}, ${lng}`;
                this.modalController("close");
                this.modalController("addtodo");
            });

            /* Loop through each task, and create a marker for it.
            We also create the event listeners for each marker. */
            this.todos.forEach(t => {
                t.lat = parseFloat(t.location.split(", ")[0]);
                t.lng = parseFloat(t.location.split(", ")[1]);

                /* Create a new marker for this todo */
                let marker = new google.maps.Marker({
                    position: { lat: t.lat, lng: t.lng},
                    map: this.map,
                    title: t.title,
                    draggable: true,
                    animation: google.maps.Animation.DROP
                });

                /* When we click the marker, it closes the map and opens an edit screen. */
                marker.addListener("click", () => {
                    this.modalController("close");
                    this.modalController("edittodo", t);
                });

                /* The event listener which saves the location if the marker is dragged. */
                google.maps.event.addListener(marker, 'dragend', (e) => {
                    t.location = `${marker.getPosition().lat()}, ${marker.getPosition().lng()}`;
                    this.editingTodo = t;
                    this.editTodo(t);
                });
            });
        },
        async getDatabase() {
            /* An internal function for grabbing the database and setting the this.database variable
               so that the database is usable in other methods. */
            return new Promise((resolve, reject) => {
                let request = window.indexedDB.open("todoapp", 1);

                request.onerror = e => alert("[ERROR] :: " + e.target.error);
                request.onsuccess = e => {
                    console.log("Database connection successfully established");
                    this.database = resolve(e.target.result)
                };
                request.onupgradeneeded = e => {
                    let db = e.target.result;
                    let objectStore = db.createObjectStore("todos", {
                        autoIncrement: true,
                        keyPath: "id"
                    });
                };
            });
        }
    },
});

/* VueJS template filters.
They allow us to alter template tags, for example, this filter truncates the description.
*/
var filter = function(text, length, clamp){
    clamp = clamp || '...';
    var node = document.createElement('div');
    node.innerHTML = text;
    var content = node.textContent;
    return content.length > length ? content.slice(0, length) + clamp : content;
};

Vue.filter('truncate', filter);





// TODO: Report on the website

/* 
1.    Add a task to the list (a task has title, description, date-time, priority and status) [DONE]
2.    Update a task [DONE]
3.    Delete single and multiple tasks [DONE]
4.    View daily/ weekly/monthly tasks list in a table [DONE]
5.    Search task by text in title and description
6.    Sort tasks by date due and priority
7.    Add one or more pictures to a task
8.    Add task location using google map (you are allowed to use online google map for the application) [DONE]
9.    View daily/ weekly/monthly tasks list in a google map (show task title and location) [DONE]
*/ 

/* Assignment Rough Score: < 40 */

