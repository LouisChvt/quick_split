// La tâche GPS d'arrière-plan doit être définie avant tout le reste :
// iOS peut relancer l'app en arrière-plan uniquement pour exécuter cette tâche.
import './src/services/location';

import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
