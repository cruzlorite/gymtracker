// Textos de la interfaz en español e inglés. El idioma se elige en Ajustes (o en la portada) y se
// recuerda en este dispositivo; la primera vez se usa el del navegador.

const KEY = 'gt:lang';
const plural = (one, many) => ({ n }) => (Number(n) === 1 ? one : many).replace('{n}', n);

const es = {
  'common.privacy': 'Privacidad', 'common.close': 'Cerrar', 'common.cancel': 'Cancelar', 'common.back': 'Atrás',
  'common.delete': 'Borrar', 'common.confirmDelete': '¿Borrar?', 'common.copy': 'Copiar', 'common.notNow': 'Ahora no',
  'common.noData': 'sin datos', 'common.you': 'Tú',
  'err.generic': 'Algo ha fallado.', 'err.session': 'Tu sesión de Google ha caducado.',
  'err.script': 'No se pudo cargar un script de Google. ¿Hay conexión?',
  'err.gisLoading': 'El login de Google aún está cargando. Prueba de nuevo en un segundo.',
  'err.drivePerm': 'Falta el permiso de Google Drive. Vuelve a entrar y, en la ventana de Google, marca la casilla «Ver, editar, crear y eliminar solo los archivos específicos de Google Drive que uses con esta aplicación».',
  'err.popupClosed': 'Has cerrado la ventana de Google.',
  'err.popupBlocked': 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes.',
  'err.signin': 'No se pudo iniciar sesión con Google.', 'err.google': 'Google respondió con un error ({status}).',
  'err.notGroup': 'Esa hoja no es un grupo de GymTracker.',
  'err.tabNotYoursOwner': 'La pestaña «{tab}» no la ha creado esta app para ti. Bórrala desde la hoja y vuelve a unirte.',
  'err.tabNotYours': 'Alguien ha creado una pestaña con tu email que no puedes controlar. Pide a {owner} que la borre de la hoja y vuelve a intentarlo.',
  'err.noTab': 'No encuentro tu pestaña en la hoja.',
  'picker.join': 'Selecciona la hoja del grupo para unirte', 'picker.choose': 'Elige la hoja del grupo',
  'invite.email': '¡Únete a nuestro grupo de GymTracker! Abre este enlace: {link}',

  'landing.title': 'Cada serie cuenta.',
  'landing.lead': 'Apunta tus entrenos en segundos, descansa con el temporizador y compite con tus amigos para ver quién va más y quién mejora más.',
  'landing.invited': 'Te han invitado a un grupo. Entra con Google para unirte.',
  'landing.google': 'Continuar con Google', 'landing.continueAs': 'Continuar como {email}',
  'landing.notConfigured': '<strong>Falta configurar Google.</strong> Rellena <code>config.js</code> siguiendo el README. Mientras tanto, puedes probar la demo.',
  'landing.demo': 'Probar la demo',
  'landing.driveHint': 'Al entrar, marca la casilla de Google Drive. La app solo accede a las hojas que crea ella o que eliges tú.',
  'landing.f1.title': 'Registro en dos toques', 'landing.f1.text': 'Peso y repeticiones con botones grandes, rellenados con tu última sesión. Pensado para usarlo entre series.',
  'landing.f2.title': 'Temporizador de descanso', 'landing.f2.text': 'Arranca solo al guardar cada serie y te avisa con sonido y vibración.',
  'landing.f3.title': 'Compite con tu grupo', 'landing.f3.text': 'Rankings de asistencia, mejora y volumen, retos y récords personales.',
  'landing.noServer': 'Sin servidores: tus datos viven en una hoja de Google Sheets de tu grupo.',

  'nav.label': 'Secciones', 'nav.log': 'Entreno', 'nav.history': 'Calendario', 'nav.progress': 'Progreso', 'nav.group': 'Grupo',
  'demo.bar': 'Modo demo: los datos son inventados y no se guardan.',
  'demo.groupName': 'Los del gym (demo)', 'demo.you': 'Tú',
  'demo.ch1': '¿Quién va más este mes?', 'demo.ch2': 'Banca: +5 % en 8 semanas', 'demo.ch3': 'Verano: más kilos de sentadilla', 'demo.ch4': 'Semana de volumen total',

  'sync.saving': 'Guardando…', 'sync.pending': plural('{n} sin subir', '{n} sin subir'),
  'sync.reconnect': 'Reconectar ({n})', 'sync.reconnectShort': 'Reconectar', 'sync.renewed': 'Sesión renovada.',
  'sync.errorTitle': 'Cambios sin subir',
  'sync.errorText': plural('Hay {n} cambio guardado en este dispositivo que todavía no ha llegado a la hoja. Se reintenta solo cuando hay conexión.', 'Hay {n} cambios guardados en este dispositivo que todavía no han llegado a la hoja. Se reintenta solo cuando hay conexión.'),
  'sync.retry': 'Reintentar', 'sync.discard': 'Descartar cambios',

  'join.title': 'Te han invitado a un grupo',
  'join.text': 'Para que la app pueda leer y escribir en la hoja del grupo, selecciónala en la ventana de Google que se abrirá. Solo hace falta la primera vez.',
  'join.button': 'Unirme al grupo',
  'join.notListed': '¿No aparece la hoja? Pide a quien te invitó que te añada con tu email ({email}).',
  'join.notMember': 'Puedes ver esta hoja, pero aún no formas parte del grupo. Al unirte se crea tu pestaña, que solo podrás editar tú.',
  'join.done': '¡Ya estás en el grupo!',
  'groups.emptyTitle': 'Aún no tienes ningún grupo',
  'groups.emptyText': 'Crea uno e invita a tus amigos, o únete al de un amigo con el enlace que te haya pasado.',
  'groups.name': 'Nombre del grupo', 'groups.namePlaceholder': 'p. ej. Los del gym', 'groups.create': 'Crear grupo', 'groups.createShort': 'Crear',
  'groups.pickShared': 'Unirme con una hoja que me han compartido',
  'groups.createNote': 'Se creará una hoja de cálculo en tu Google Drive. Después podrás invitar a tus amigos.',
  'groups.createDemoNote': 'En la demo el grupo solo existe mientras no recargues.',
  'groups.created': 'Grupo creado. ¡Invita a tus amigos!',
  'suspicious': ({ n, tabs }) => `${Number(n) === 1 ? 'Hay una pestaña que no se tiene en cuenta porque no está protegida a nombre de su dueño' : `Hay ${n} pestañas que no se tienen en cuenta porque no están protegidas a nombre de su dueño`}: <strong>${tabs}</strong>.`,
  'suspicious.open': 'Si no las reconoces, bórralas desde la hoja.',

  'day.today': 'Hoy', 'day.prev': 'Día anterior', 'day.next': 'Día siguiente', 'day.pick': 'Elegir fecha',
  'log.emptyToday': 'Hoy aún no has entrenado', 'log.emptyDay': 'Sin entreno este día',
  'log.emptyText': 'Añade el primer ejercicio y ve guardando cada serie según la terminas.',
  'log.addExercise': 'Añadir ejercicio', 'log.markAttendance': 'Solo marcar que fui',
  'log.repeat': 'Repetir el entreno del {day}', 'log.repeatHint': 'Toca un ejercicio para empezar con los pesos de ese día.',
  'log.exercises': plural('ejercicio', 'ejercicios'), 'log.sets': plural('{n} serie', '{n} series'), 'log.setsWord': plural('serie', 'series'), 'log.volume': 'volumen',
  'log.attended': 'Día de gym marcado', 'log.attendanceSaved': 'Día de gym apuntado.',

  'cal.nobody': 'nadie', 'cal.prev': 'Mes anterior', 'cal.next': 'Mes siguiente', 'cal.daysThisMonth': 'Días este mes',
  'cal.hint': 'Toca un día para ver qué hizo cada uno.', 'cal.openMine': 'Abrir mi entreno de ese día',

  'period.label': 'Periodo', 'period.7': '7 días', 'period.30': '30 días', 'period.90': '90 días', 'period.365': '1 año', 'period.all': 'Todo',
  'progress.emptyTitle': 'Aún no hay progreso que mostrar', 'progress.emptyText': 'Cuando registréis ejercicios con peso, aquí veréis la evolución de cada uno.',
  'progress.exercise': 'Ejercicio', 'progress.compare': 'Comparar con el grupo', 'progress.chartLabel': 'Evolución del 1RM estimado',
  'progress.e1rmHelp': '1RM estimado: el peso que podrías levantar a una repetición, calculado a partir de tus series (fórmula de Epley). Permite comparar series con distintas repeticiones.',
  'progress.improvement': 'Mejora en el periodo', 'progress.person': 'Persona', 'progress.start': 'Inicio', 'progress.best': 'Mejor', 'progress.change': 'Cambio',
  'progress.needTwo': 'Necesita 2 días con este ejercicio', 'progress.myRecords': 'Mis récords', 'progress.records': 'Récords',
  'progress.bestSet': 'Mejor serie', 'progress.e1rm': '1RM est.', 'progress.noRecords': 'Aún no hay ejercicios con peso.',

  'group.groups': 'Grupos', 'group.invite': 'Invitar', 'group.ranking': 'Ranking', 'group.challenges': 'Retos', 'group.members': 'Miembros',
  'group.creator': 'quien creó el grupo', 'group.of': 'de {owner}', 'group.refresh': 'Actualizar datos', 'group.openSheet': 'Abrir la hoja en Google Sheets',
  'ranking.summary': 'El grupo ha ido <strong>{sessions}</strong> veces en <strong>{days}</strong> días distintos.',
  'ranking.none': 'Nadie ha registrado entrenos en este periodo todavía.',
  'ranking.attendance': 'Quién va más', 'ranking.attendanceSub': 'Días de gym en el periodo',
  'ranking.improvement': 'Quién mejora más', 'ranking.improvementSub': 'Subida media del 1RM estimado',
  'ranking.improvementNote': 'Compara el primer día del periodo con tu mejor marca después, ejercicio a ejercicio. Así es justo entre niveles distintos.',
  'ranking.streak': 'Racha', 'ranking.streakSub': 'Semanas seguidas yendo al menos un día', 'ranking.streakNote': 'La racha no depende del periodo elegido.',
  'ranking.volume': 'Volumen', 'ranking.volumeSub': 'Kilos totales (series × reps × kg)',
  'unit.days': '{n} d', 'unit.weeks': '{n} sem', 'unit.bw': 'PC',

  'ch.new': 'Nuevo reto', 'ch.emptyTitle': 'Todavía no hay retos', 'ch.emptyText': 'Propón uno al grupo: asistencia, volumen o mejora en un ejercicio.',
  'ch.startsOn': 'Empieza el {date}', 'ch.finished': 'Terminado', 'ch.lastDay': 'Último día', 'ch.daysLeft': plural('Queda {n} día', 'Quedan {n} días'),
  'ch.asistencia': 'Asistencia', 'ch.volumen': 'Volumen', 'ch.mejora': 'Mejora',
  'ch.asistencia.help': 'Gana quien vaya más días.', 'ch.volumen.help': 'Gana quien levante más kilos en total (series × reps × kg).',
  'ch.mejora.help': 'Gana quien más suba su 1RM estimado respecto a su primer día del reto.',
  'ch.by': 'propuesto por {name}', 'ch.winner': 'Ha ganado <strong>{name}</strong>',
  'ch.titleLabel': 'Título', 'ch.titlePlaceholder': 'p. ej. Noviembre sin fallar', 'ch.type': 'Tipo', 'ch.exercise': 'Ejercicio (para volumen o mejora)',
  'ch.allExercises': 'Todos los ejercicios', 'ch.start': 'Empieza', 'ch.end': 'Termina', 'ch.create': 'Crear reto',
  'ch.badDates': 'La fecha de fin es anterior a la de inicio.', 'ch.created': 'Reto creado.',

  'members.noWorkouts': 'Sin entrenos todavía.', 'members.since': 'en el grupo desde {date}', 'members.totalDays': 'Días totales',
  'members.last30': 'Últimos 30 días', 'members.improvement90': 'Mejora 90 días', 'members.recent': 'Últimos entrenos',

  'picker.title': 'Añadir ejercicio', 'picker.new': 'Nuevo', 'picker.search': 'Buscar ejercicio', 'picker.all': 'Todos',
  'picker.create': 'Crear «{name}»', 'picker.noResults': 'No hay ejercicios con ese nombre.', 'picker.recent': 'Recientes',

  'ex.log': 'Registrar', 'ex.history': 'Historial', 'ex.weight': 'Peso', 'ex.reps': 'Reps',
  'ex.less': 'Menos {what}', 'ex.more': 'Más {what}', 'ex.save': 'Guardar serie', 'ex.update': 'Actualizar',
  'ex.editing': 'Editando la serie {n}', 'ex.bwHint': 'Con el peso corporal: deja 0 kg o apunta el lastre.',
  'ex.lastTime': 'Última vez · {day}', 'ex.todaySets': 'Series de hoy', 'ex.daySets': 'Series de ese día',
  'ex.noSetsYet': 'Ajusta el peso y las repeticiones y pulsa «Guardar serie».', 'ex.noHistory': 'Aún no has hecho este ejercicio.',
  'ex.maxWeight': 'Peso máximo', 'ex.sessions': 'Sesiones', 'ex.seeChart': 'Ver gráfica', 'ex.pr': 'Récord personal',
  'ex.needReps': 'Indica las repeticiones.', 'ex.updated': 'Serie actualizada.', 'ex.newPr': '¡Nuevo récord personal!',

  'timer.title': 'Temporizador de descanso', 'timer.rest': 'Descanso', 'timer.done': '¡A por la siguiente serie!',
  'timer.minus': 'Quitar 15 segundos', 'timer.plus': 'Añadir 15 segundos', 'timer.skip': 'Saltar descanso',
  'timer.duration': 'Descanso entre series', 'timer.auto': 'Arrancar al guardar una serie', 'timer.autoHelp': 'Te avisa con sonido y vibración al terminar.',
  'timer.startNow': 'Empezar ahora',

  'settings.title': 'Ajustes', 'settings.language': 'Idioma', 'settings.theme': 'Tema', 'settings.system': 'Sistema',
  'settings.light': 'Claro', 'settings.dark': 'Oscuro', 'settings.step': 'Incremento de peso',
  'settings.demoNote': 'Estás en modo demo.',
  'settings.dataNote': 'Tus entrenos se guardan en tu pestaña de la hoja de cada grupo. Solo tú (y quien creó el grupo) podéis editarla.',
  'settings.exitDemo': 'Salir de la demo', 'settings.signOut': 'Cerrar sesión',

  'newEx.title': 'Nuevo ejercicio', 'newEx.name': 'Nombre', 'newEx.placeholder': 'p. ej. Press Arnold', 'newEx.category': 'Grupo muscular',
  'newEx.shared': 'Se guarda en la hoja del grupo: lo verá todo el mundo en el buscador.', 'newEx.create': 'Crear ejercicio',
  'newEx.created': '«{name}» añadido.',

  'invite.title': 'Invitar amigos',
  'invite.text': 'Invitar a alguien comparte la hoja desde tu Google Drive con su email, y Google le envía un correo con el enlace del grupo.',
  'invite.emailLabel': 'Email de tu amigo', 'invite.send': 'Invitar',
  'invite.onlyOwner': 'Solo {owner} puede añadir gente a la hoja del grupo. Pásale el email de tu amigo y, cuando le haya invitado, mándale este enlace.',
  'invite.link': 'Enlace del grupo', 'invite.linkNote': 'El enlace solo funciona para quien tenga la hoja compartida.',
  'invite.demoNote': '(En la demo no se envía nada.)', 'invite.copied': 'Enlace copiado.', 'invite.copyFailed': 'No se pudo copiar; selecciónalo a mano.',
  'invite.demoSent': 'En la demo no se envían invitaciones.', 'invite.sent': 'Invitación enviada a {email}.',
};

const en = {
  'common.privacy': 'Privacy', 'common.close': 'Close', 'common.cancel': 'Cancel', 'common.back': 'Back',
  'common.delete': 'Delete', 'common.confirmDelete': 'Delete?', 'common.copy': 'Copy', 'common.notNow': 'Not now',
  'common.noData': 'no data', 'common.you': 'You',
  'err.generic': 'Something went wrong.', 'err.session': 'Your Google session has expired.',
  'err.script': "Couldn't load a Google script. Are you online?",
  'err.gisLoading': 'Google sign-in is still loading. Try again in a second.',
  'err.drivePerm': 'The Google Drive permission is missing. Sign in again and, in the Google window, tick the box "See, edit, create, and delete only the specific Google Drive files you use with this app".',
  'err.popupClosed': 'You closed the Google window.',
  'err.popupBlocked': 'Your browser blocked the Google window. Please allow pop-ups.',
  'err.signin': "Couldn't sign in with Google.", 'err.google': 'Google returned an error ({status}).',
  'err.notGroup': "That sheet isn't a GymTracker group.",
  'err.tabNotYoursOwner': "The tab \"{tab}\" wasn't created for you by this app. Delete it from the sheet and join again.",
  'err.tabNotYours': "Someone created a tab with your email that you can't control. Ask {owner} to delete it from the sheet and try again.",
  'err.noTab': "Can't find your tab in the sheet.",
  'picker.join': "Select the group's sheet to join", 'picker.choose': "Choose the group's sheet",
  'invite.email': 'Join our GymTracker group! Open this link: {link}',

  'landing.title': 'Every set counts.',
  'landing.lead': 'Log your workouts in seconds, rest with the built-in timer and compete with friends to see who trains most and who improves most.',
  'landing.invited': "You've been invited to a group. Sign in with Google to join.",
  'landing.google': 'Continue with Google', 'landing.continueAs': 'Continue as {email}',
  'landing.notConfigured': '<strong>Google is not configured yet.</strong> Fill in <code>config.js</code> following the README. Meanwhile, try the demo.',
  'landing.demo': 'Try the demo',
  'landing.driveHint': 'When signing in, tick the Google Drive box. The app only accesses sheets it creates or that you pick.',
  'landing.f1.title': 'Two-tap logging', 'landing.f1.text': 'Big weight and rep buttons, pre-filled from your last session. Built to use between sets.',
  'landing.f2.title': 'Rest timer', 'landing.f2.text': 'Starts automatically when you save a set and alerts you with sound and vibration.',
  'landing.f3.title': 'Compete with your group', 'landing.f3.text': 'Attendance, improvement and volume rankings, challenges and personal records.',
  'landing.noServer': 'No servers: your data lives in a Google Sheet owned by your group.',

  'nav.label': 'Sections', 'nav.log': 'Workout', 'nav.history': 'Calendar', 'nav.progress': 'Progress', 'nav.group': 'Group',
  'demo.bar': 'Demo mode: the data is made up and nothing is saved.',
  'demo.groupName': 'Gym crew (demo)', 'demo.you': 'You',
  'demo.ch1': 'Who trains most this month?', 'demo.ch2': 'Bench: +5% in 8 weeks', 'demo.ch3': 'Summer squat volume', 'demo.ch4': 'Total volume week',

  'sync.saving': 'Saving…', 'sync.pending': plural('{n} not synced', '{n} not synced'),
  'sync.reconnect': 'Reconnect ({n})', 'sync.reconnectShort': 'Reconnect', 'sync.renewed': 'Session renewed.',
  'sync.errorTitle': 'Unsynced changes',
  'sync.errorText': plural("There is {n} change saved on this device that hasn't reached the sheet yet. It retries automatically when you're online.", "There are {n} changes saved on this device that haven't reached the sheet yet. They retry automatically when you're online."),
  'sync.retry': 'Retry', 'sync.discard': 'Discard changes',

  'join.title': "You've been invited to a group",
  'join.text': "So the app can read and write the group's sheet, select it in the Google window that opens. You only need to do this once.",
  'join.button': 'Join the group',
  'join.notListed': "Sheet not listed? Ask whoever invited you to add your email ({email}).",
  'join.notMember': "You can see this sheet, but you're not in the group yet. Joining creates your own tab that only you can edit.",
  'join.done': "You're in the group!",
  'groups.emptyTitle': "You don't have any groups yet",
  'groups.emptyText': "Create one and invite your friends, or join a friend's group with the link they sent you.",
  'groups.name': 'Group name', 'groups.namePlaceholder': 'e.g. Gym crew', 'groups.create': 'Create group', 'groups.createShort': 'Create',
  'groups.pickShared': 'Join with a sheet shared with me',
  'groups.createNote': "A spreadsheet will be created in your Google Drive. Then you can invite your friends.",
  'groups.createDemoNote': 'In the demo the group only exists until you reload.',
  'groups.created': 'Group created. Invite your friends!',
  'suspicious': ({ n, tabs }) => `${Number(n) === 1 ? "One tab is ignored because it isn't protected in its owner's name" : `${n} tabs are ignored because they aren't protected in their owner's name`}: <strong>${tabs}</strong>.`,
  'suspicious.open': "If you don't recognise them, delete them from the sheet.",

  'day.today': 'Today', 'day.prev': 'Previous day', 'day.next': 'Next day', 'day.pick': 'Pick a date',
  'log.emptyToday': "You haven't trained today yet", 'log.emptyDay': 'No workout on this day',
  'log.emptyText': 'Add your first exercise and save each set as you finish it.',
  'log.addExercise': 'Add exercise', 'log.markAttendance': 'Just mark that I went',
  'log.repeat': 'Repeat {day}', 'log.repeatHint': "Tap an exercise to start with that day's weights.",
  'log.exercises': plural('exercise', 'exercises'), 'log.sets': plural('{n} set', '{n} sets'), 'log.setsWord': plural('set', 'sets'), 'log.volume': 'volume',
  'log.attended': 'Gym day marked', 'log.attendanceSaved': 'Gym day logged.',

  'cal.nobody': 'nobody', 'cal.prev': 'Previous month', 'cal.next': 'Next month', 'cal.daysThisMonth': 'Days this month',
  'cal.hint': 'Tap a day to see what everyone did.', 'cal.openMine': 'Open my workout for that day',

  'period.label': 'Period', 'period.7': '7 days', 'period.30': '30 days', 'period.90': '90 days', 'period.365': '1 year', 'period.all': 'All',
  'progress.emptyTitle': 'No progress to show yet', 'progress.emptyText': "Once you log exercises with weight, you'll see everyone's progress here.",
  'progress.exercise': 'Exercise', 'progress.compare': 'Compare with group', 'progress.chartLabel': 'Estimated 1RM over time',
  'progress.e1rmHelp': 'Estimated 1RM: the weight you could lift for one rep, calculated from your sets (Epley formula). It lets you compare sets with different rep counts.',
  'progress.improvement': 'Improvement in period', 'progress.person': 'Person', 'progress.start': 'Start', 'progress.best': 'Best', 'progress.change': 'Change',
  'progress.needTwo': 'Needs 2 days with this exercise', 'progress.myRecords': 'My records', 'progress.records': 'Records',
  'progress.bestSet': 'Best set', 'progress.e1rm': 'Est. 1RM', 'progress.noRecords': 'No weighted exercises yet.',

  'group.groups': 'Groups', 'group.invite': 'Invite', 'group.ranking': 'Ranking', 'group.challenges': 'Challenges', 'group.members': 'Members',
  'group.creator': 'the group creator', 'group.of': 'by {owner}', 'group.refresh': 'Refresh data', 'group.openSheet': 'Open the sheet in Google Sheets',
  'ranking.summary': 'The group trained <strong>{sessions}</strong> times across <strong>{days}</strong> different days.',
  'ranking.none': 'Nobody has logged a workout in this period yet.',
  'ranking.attendance': 'Who trains most', 'ranking.attendanceSub': 'Gym days in the period',
  'ranking.improvement': 'Who improves most', 'ranking.improvementSub': 'Average estimated 1RM increase',
  'ranking.improvementNote': 'Compares the first day of the period with your best mark after it, exercise by exercise. Fair across different levels.',
  'ranking.streak': 'Streak', 'ranking.streakSub': 'Consecutive weeks with at least one gym day', 'ranking.streakNote': "Streaks don't depend on the selected period.",
  'ranking.volume': 'Volume', 'ranking.volumeSub': 'Total kilos (sets × reps × kg)',
  'unit.days': '{n} d', 'unit.weeks': '{n} wk', 'unit.bw': 'BW',

  'ch.new': 'New challenge', 'ch.emptyTitle': 'No challenges yet', 'ch.emptyText': 'Propose one to the group: attendance, volume or improvement on an exercise.',
  'ch.startsOn': 'Starts {date}', 'ch.finished': 'Finished', 'ch.lastDay': 'Last day', 'ch.daysLeft': plural('{n} day left', '{n} days left'),
  'ch.asistencia': 'Attendance', 'ch.volumen': 'Volume', 'ch.mejora': 'Improvement',
  'ch.asistencia.help': 'Whoever trains on the most days wins.', 'ch.volumen.help': 'Whoever lifts the most total kilos wins (sets × reps × kg).',
  'ch.mejora.help': 'Whoever raises their estimated 1RM the most from their first day of the challenge wins.',
  'ch.by': 'proposed by {name}', 'ch.winner': '<strong>{name}</strong> won',
  'ch.titleLabel': 'Title', 'ch.titlePlaceholder': 'e.g. No-miss November', 'ch.type': 'Type', 'ch.exercise': 'Exercise (for volume or improvement)',
  'ch.allExercises': 'All exercises', 'ch.start': 'Starts', 'ch.end': 'Ends', 'ch.create': 'Create challenge',
  'ch.badDates': 'The end date is before the start date.', 'ch.created': 'Challenge created.',

  'members.noWorkouts': 'No workouts yet.', 'members.since': 'in the group since {date}', 'members.totalDays': 'Total days',
  'members.last30': 'Last 30 days', 'members.improvement90': '90-day improvement', 'members.recent': 'Recent workouts',

  'picker.title': 'Add exercise', 'picker.new': 'New', 'picker.search': 'Search exercises', 'picker.all': 'All',
  'picker.create': 'Create "{name}"', 'picker.noResults': 'No exercises with that name.', 'picker.recent': 'Recent',

  'ex.log': 'Log', 'ex.history': 'History', 'ex.weight': 'Weight', 'ex.reps': 'Reps',
  'ex.less': 'Less {what}', 'ex.more': 'More {what}', 'ex.save': 'Save set', 'ex.update': 'Update',
  'ex.editing': 'Editing set {n}', 'ex.bwHint': 'Bodyweight: leave 0 kg or log the added weight.',
  'ex.lastTime': 'Last time · {day}', 'ex.todaySets': "Today's sets", 'ex.daySets': "That day's sets",
  'ex.noSetsYet': 'Set the weight and reps, then tap "Save set".', 'ex.noHistory': "You haven't done this exercise yet.",
  'ex.maxWeight': 'Max weight', 'ex.sessions': 'Sessions', 'ex.seeChart': 'See chart', 'ex.pr': 'Personal record',
  'ex.needReps': 'Enter the reps.', 'ex.updated': 'Set updated.', 'ex.newPr': 'New personal record!',

  'timer.title': 'Rest timer', 'timer.rest': 'Rest', 'timer.done': 'Time for the next set!',
  'timer.minus': 'Remove 15 seconds', 'timer.plus': 'Add 15 seconds', 'timer.skip': 'Skip rest',
  'timer.duration': 'Rest between sets', 'timer.auto': 'Start when saving a set', 'timer.autoHelp': 'Alerts you with sound and vibration when done.',
  'timer.startNow': 'Start now',

  'settings.title': 'Settings', 'settings.language': 'Language', 'settings.theme': 'Theme', 'settings.system': 'System',
  'settings.light': 'Light', 'settings.dark': 'Dark', 'settings.step': 'Weight increment',
  'settings.demoNote': "You're in demo mode.",
  'settings.dataNote': 'Your workouts are saved in your tab of each group sheet. Only you (and the group creator) can edit it.',
  'settings.exitDemo': 'Exit demo', 'settings.signOut': 'Sign out',

  'newEx.title': 'New exercise', 'newEx.name': 'Name', 'newEx.placeholder': 'e.g. Arnold press', 'newEx.category': 'Muscle group',
  'newEx.shared': "It's saved in the group sheet, so everyone will see it in search.", 'newEx.create': 'Create exercise',
  'newEx.created': '"{name}" added.',

  'invite.title': 'Invite friends',
  'invite.text': 'Inviting someone shares the sheet from your Google Drive with their email, and Google sends them an email with the group link.',
  'invite.emailLabel': "Your friend's email", 'invite.send': 'Invite',
  'invite.onlyOwner': "Only {owner} can add people to the group's sheet. Send them your friend's email and, once they're invited, share this link.",
  'invite.link': 'Group link', 'invite.linkNote': 'The link only works for people the sheet is shared with.',
  'invite.demoNote': '(Nothing is sent in the demo.)', 'invite.copied': 'Link copied.', 'invite.copyFailed': "Couldn't copy; select it manually.",
  'invite.demoSent': 'Invitations are not sent in the demo.', 'invite.sent': 'Invitation sent to {email}.',
};

const DICT = { es, en };

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch { /* sin storage */ }
  return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
}
let lang = initial();

export const getLang = () => lang;
export const locale = () => (lang === 'es' ? 'es-ES' : 'en-GB');
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'es';
  try { localStorage.setItem(KEY, lang); } catch { /* sin storage */ }
}

/** Texto traducido; {var} se sustituye por vars.var. Las variables con HTML deben venir ya escapadas. */
export function t(key, vars = {}) {
  const v = DICT[lang][key] ?? DICT.es[key] ?? key;
  const s = typeof v === 'function' ? v(vars) : v;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

export const KEYS = { es: Object.keys(es), en: Object.keys(en) };
