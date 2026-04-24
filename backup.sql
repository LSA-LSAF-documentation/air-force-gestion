
-- Datos de rangos
INSERT INTO "rangos" ("id","code","nombre","orden","created_at") VALUES
(1,'Amn','Aviador',1,'2026-04-24 07:53:56'),
(2,'TSgt','Sargento Técnico',5,'2026-04-24 07:53:56'),
(3,'MSgt','Sargento Maestre',6,'2026-04-24 07:53:56'),
(4,'SMSgt','Sargento Maestre Mayor',7,'2026-04-24 07:53:56'),
(5,'CMSgt','Sargento Maestre de la Fuerza Aérea',8,'2026-04-24 07:53:56'),
(6,'CMSAF','Suboficial Mayor de la Fuerza Aérea',9,'2026-04-24 07:53:56'),
(7,'2d Lt','Teniente Segundo',10,'2026-04-24 07:53:56'),
(8,'1st Lt','Teniente Primero',11,'2026-04-24 07:53:56'),
(9,'Capt','Capitán',12,'2026-04-24 07:53:56'),
(10,'Maj','Major',13,'2026-04-24 07:53:56'),
(11,'Lt Col','Teniente Coronel',14,'2026-04-24 07:53:56'),
(12,'Col','Coronel',15,'2026-04-24 07:53:56'),
(13,'Brig Gen','Brigadier General',16,'2026-04-24 07:53:56'),
(14,'Maj Gen','Mayor General',17,'2026-04-24 07:53:56'),
(15,'Lt Gen','Teniente General',18,'2026-04-24 07:53:56'),
(16,'A1C','Aviador de primera',2,'2026-04-24 07:53:56'),
(17,'SrA','Aviador Mayor',3,'2026-04-24 07:53:56'),
(18,'SSgt','Sargento de personal',4,'2026-04-24 07:53:56'),
(19,'Gen','General',19,'2026-04-24 07:53:56');

-- Datos de pilotos
INSERT INTO "pilotos" ("id","nombre_completo","grado_code","email","password_hash","tipo_sangre","nacionalidad","rol","foto_url","horas_totales","created_at") VALUES
('CAP123','Carlos Pérez','Capt','carlos.perez@airforce.mil','$2a$10$.pr3gQK6JmP/VbB42pTyxuygo.nrJLvd5np1sfFEC1XljrP5ZMXo6','O+','LS','Admin',NULL,0,'2026-04-24 07:53:56'),
('MAJ456','Laura Méndez','Maj','laura.mendez@airforce.mil','$2a$10$.pr3gQK6JmP/VbB42pTyxuygo.nrJLvd5np1sfFEC1XljrP5ZMXo6','A+','LS','Instructor',NULL,0,'2026-04-24 07:53:56'),
('LT789','Miguel Rodríguez','1st Lt','miguel.rodriguez@airforce.mil','$2a$10$.pr3gQK6JmP/VbB42pTyxuygo.nrJLvd5np1sfFEC1XljrP5ZMXo6','B+','US','Piloto',NULL,0,'2026-04-24 07:53:56');
